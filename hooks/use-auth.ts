"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearSessionAndRecreateClient,
  createClient,
} from "@/lib/supabase/client";

interface AuthState {
  displayName: string;
  isAnonymous: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  user: User | null;
  userId: string | null;
}

interface LinkIdentityResult {
  error?: string;
  success: boolean;
}

interface AuthContextValue {
  displayName: string;
  isAnonymous: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  linkGitHubIdentity: () => Promise<LinkIdentityResult>;
  updateDisplayName: (newName: string) => Promise<boolean>;
  user: User | null;
  userId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GITHUB_LINK_PENDING_KEY = "r8ro-github-link-pending";

function clearGitHubLinkPendingState() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(GITHUB_LINK_PENDING_KEY);
}

function markGitHubLinkPendingState() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(GITHUB_LINK_PENDING_KEY, "1");
}

function useAuthState(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    userId: null,
    displayName: "",
    isLoading: true,
    isInitialized: false,
    isAnonymous: true,
  });

  const supabaseRef = useRef(createClient());
  const isRecoveringRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    async function signInAnonymously(
      client: ReturnType<typeof createClient>,
      isMounted: boolean
    ) {
      const legacyName =
        typeof window === "undefined"
          ? ""
          : localStorage.getItem("retro_username") || "";

      const { data, error } = await client.auth.signInAnonymously({
        options: {
          data: {
            display_name: legacyName,
          },
        },
      });

      if (error) {
        console.error("Anonymous sign-in failed:", error);
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isInitialized: true,
          }));
        }
        return;
      }

      if (data.user && isMounted) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("retro_username");
          localStorage.removeItem("retro_user_id");
        }

        setState({
          user: data.user,
          userId: data.user.id,
          displayName: legacyName,
          isLoading: false,
          isInitialized: true,
          isAnonymous: true,
        });
      }
    }

    async function recoverFromCorruptedSession() {
      if (isRecoveringRef.current) {
        return;
      }
      isRecoveringRef.current = true;

      const freshClient = clearSessionAndRecreateClient();
      supabaseRef.current = freshClient;

      await signInAnonymously(freshClient, mounted);
      isRecoveringRef.current = false;
    }

    async function initAuth() {
      const supabase = supabaseRef.current;

      if (typeof window !== "undefined") {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const pendingGitHubLink =
          sessionStorage.getItem(GITHUB_LINK_PENDING_KEY) === "1";
        const hashErrorCode = hashParams.get("error_code");

        if (pendingGitHubLink && hashErrorCode === "identity_already_exists") {
          const callbackUrl = new URL("/auth/callback", window.location.origin);

          window.location.replace(callbackUrl.toString());
          return;
        }
      }

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          const errorMsg = userError.message || "";
          if (
            errorMsg.includes("user_not_found") ||
            errorMsg.includes("User from sub claim")
          ) {
            await recoverFromCorruptedSession();
            return;
          }
        }

        if (!userData?.user) {
          await signInAnonymously(supabase, mounted);
          return;
        }

        const displayName = userData.user.user_metadata?.display_name || "";
        const isAnonymous = !!userData.user.is_anonymous;

        if (!isAnonymous) {
          clearGitHubLinkPendingState();
        }

        if (mounted) {
          setState({
            user: userData.user,
            userId: userData.user.id,
            displayName,
            isLoading: false,
            isInitialized: true,
            isAnonymous,
          });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("user_not_found") ||
          errorMessage.includes("User from sub claim")
        ) {
          await recoverFromCorruptedSession();
          return;
        }

        console.error("Auth initialization error:", error);
        await recoverFromCorruptedSession();
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((event, session) => {
      if (!mounted || isRecoveringRef.current) {
        return;
      }

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        if (event === "SIGNED_OUT") {
          await signInAnonymously(supabaseRef.current, mounted);
        } else if (session?.user) {
          const isAnonymous = !!session.user.is_anonymous;

          if (!isAnonymous) {
            clearGitHubLinkPendingState();
          }

          setState({
            user: session.user,
            userId: session.user.id,
            displayName: session.user.user_metadata?.display_name || "",
            isLoading: false,
            isInitialized: true,
            isAnonymous,
          });
        }
      }, 100);
    });

    return () => {
      mounted = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, []);

  const updateDisplayName = useCallback(async (newName: string) => {
    const trimmedName = newName.trim();

    const { data: sessionData } = await supabaseRef.current.auth.getSession();
    if (!sessionData?.session) {
      console.error("Failed to update display name: Auth session missing!");
      return false;
    }

    const { data, error } = await supabaseRef.current.auth.updateUser({
      data: { display_name: trimmedName },
    });

    if (error) {
      console.error("Failed to update display name:", error);
      return false;
    }

    if (data.user) {
      setState((prev) => ({
        ...prev,
        displayName: trimmedName,
        user: data.user,
      }));
    }

    return true;
  }, []);

  const linkGitHubIdentity =
    useCallback(async (): Promise<LinkIdentityResult> => {
      if (!state.isAnonymous) {
        clearGitHubLinkPendingState();
        console.error("User is not anonymous");
        return { success: false, error: "User is not anonymous" };
      }

      try {
        const nextPath =
          typeof window === "undefined"
            ? "/"
            : `${window.location.pathname}${window.location.search}`;
        const prepareResponse = await fetch("/auth/link/start", {
          body: JSON.stringify({ next: nextPath }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!prepareResponse.ok) {
          clearGitHubLinkPendingState();
          let errorMessage = "Failed to prepare GitHub account linking";

          try {
            const payload: unknown = await prepareResponse.json();
            if (
              typeof payload === "object" &&
              payload !== null &&
              "error" in payload &&
              typeof payload.error === "string" &&
              payload.error.length > 0
            ) {
              errorMessage = payload.error;
            }
          } catch {
            // Ignore JSON parsing errors and keep fallback message.
          }

          console.error(
            "Failed to prepare GitHub identity linking:",
            errorMessage
          );
          return { success: false, error: errorMessage };
        }

        const redirectUrl =
          typeof window === "undefined"
            ? "/auth/callback"
            : (() => {
                markGitHubLinkPendingState();

                return new URL(
                  "/auth/callback",
                  window.location.origin
                ).toString();
              })();

        const { error } = await supabaseRef.current.auth.linkIdentity({
          provider: "github",
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (error) {
          clearGitHubLinkPendingState();
          console.error("Failed to link GitHub identity:", error);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (error: unknown) {
        clearGitHubLinkPendingState();
        console.error("Failed to link GitHub identity:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to link GitHub account",
        };
      }
    }, [state.isAnonymous]);

  return {
    user: state.user,
    userId: state.userId,
    displayName: state.displayName,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    isAnonymous: state.isAnonymous,
    updateDisplayName,
    linkGitHubIdentity,
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuthState();

  return createElement(AuthContext.Provider, { value: auth }, children);
}

export function useAuth() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return auth;
}
