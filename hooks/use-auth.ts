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
  authError: string | null;
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
  authError: string | null;
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

// Remembers the identity that last worked for this browser. It is a
// diagnostic breadcrumb only: it is never treated as proof of ownership, and
// it never re-authorises a request. Its purpose is to tell a genuine new
// visitor apart from one whose session failed to load, so that a transient
// failure does not mint a replacement account and orphan the boards that the
// original account owns.
const KNOWN_IDENTITY_KEY = "r8ro:last-user";

function rememberIdentity(user: User) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      KNOWN_IDENTITY_KEY,
      JSON.stringify({
        userId: user.id,
        displayName: user.user_metadata?.display_name ?? "",
      })
    );
  } catch {
    // A diagnostic checkpoint must never break a working session.
  }
}

function hasKnownIdentity() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return localStorage.getItem(KNOWN_IDENTITY_KEY) !== null;
  } catch {
    // If storage cannot be read, assume an identity exists so that a failure
    // never authorises replacing it.
    return true;
  }
}

function useAuthState(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    authError: null,
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

    // Reports that the session could not be verified, without discarding the
    // identity. The UI shows this instead of loading forever.
    function stopForAuthFailure(error: unknown) {
      console.error("Auth verification failed:", error);

      if (mounted) {
        setState((previous) => ({
          ...previous,
          authError:
            "We could not verify your session. Please retry, and avoid clearing browser data.",
          user: null,
          userId: null,
          isLoading: false,
          isInitialized: true,
        }));
      }
    }

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
            authError:
              "We could not start a session. The service may be unavailable.",
            isLoading: false,
            isInitialized: true,
          }));
        }
        return;
      }

      if (data.user && isMounted) {
        const signedInUser = data.user;

        if (typeof window !== "undefined") {
          localStorage.removeItem("retro_username");
          localStorage.removeItem("retro_user_id");
        }

        setState((previous) => ({
          ...previous,
          authError: null,
          user: signedInUser,
          userId: signedInUser.id,
          displayName: legacyName,
          isLoading: false,
          isInitialized: true,
          isAnonymous: true,
        }));

        rememberIdentity(data.user);
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
        // Read the session first. A visitor with no session at all is a new
        // visitor and may be given an anonymous account. A visitor whose
        // session could not be verified is not: minting a new account would
        // silently detach them from the boards they own.
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

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
          if (!sessionData.session) {
            // Genuinely new visitor: no session and no stored identity.
            await signInAnonymously(supabase, mounted);
            return;
          }

          // There is a session but the user could not be resolved. Report it
          // instead of replacing the identity.
          stopForAuthFailure(userError ?? new Error("User unavailable"));
          return;
        }

        const displayName = userData.user.user_metadata?.display_name || "";
        const isAnonymous = !!userData.user.is_anonymous;

        if (!isAnonymous) {
          clearGitHubLinkPendingState();
        }

        rememberIdentity(userData.user);

        if (mounted) {
          setState((previous) => ({
            ...previous,
            authError: null,
            user: userData.user,
            userId: userData.user.id,
            displayName,
            isLoading: false,
            isInitialized: true,
            isAnonymous,
          }));
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
        stopForAuthFailure(error);
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
          // A sign out for a browser that already had an identity is a
          // failure, not a fresh visit. Minting a replacement account here
          // would strand the boards the previous account owned.
          if (hasKnownIdentity()) {
            stopForAuthFailure(new Error("Session ended unexpectedly"));
            return;
          }

          await signInAnonymously(supabaseRef.current, mounted);
        } else if (session?.user) {
          const isAnonymous = !!session.user.is_anonymous;

          if (!isAnonymous) {
            clearGitHubLinkPendingState();
          }

          rememberIdentity(session.user);

          setState((previous) => ({
            ...previous,
            authError: null,
            user: session.user,
            userId: session.user.id,
            displayName: session.user.user_metadata?.display_name || "",
            isLoading: false,
            isInitialized: true,
            isAnonymous,
          }));
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
    authError: state.authError,
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
