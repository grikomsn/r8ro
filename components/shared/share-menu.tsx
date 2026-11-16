"use client";

import { Copy, ImageIcon, Share, Share2 } from "lucide-react";
import type React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reportActionError } from "@/lib/utils/errors";

interface ShareMenuProps {
  /** CSS selector of the element captured by "Copy as image". */
  captureSelector: string;
  /** Extra items, such as exports, rendered under their own heading. */
  children?: React.ReactNode;
  filenameBase: string;
  shareText: string;
  title: string;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied", {
      description: "Anyone with the link can join while it is public.",
    });
  } catch (error) {
    reportActionError("Could not copy the link", error);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The image could not be created."));
      }
    }, "image/png");
  });
}

export function ShareMenu({
  captureSelector,
  children,
  filenameBase,
  shareText,
  title,
}: ShareMenuProps) {
  const supportsNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareNative = async () => {
    try {
      await navigator.share({
        title: `r8ro · ${title}`,
        text: shareText,
        url: window.location.href,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        reportActionError("Could not share", error);
      }
    }
  };

  const captureAsImage = async () => {
    const element = document.querySelector<HTMLElement>(captureSelector);
    if (!element) {
      return;
    }

    const toastId = toast.loading("Capturing image…");

    try {
      const { default: html2canvas } = await import("html2canvas");
      const background = getComputedStyle(document.body).backgroundColor;
      const canvas = await html2canvas(element, {
        backgroundColor: background || "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        // Capture the full scrollable content, not only the visible part.
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const blob = await canvasToBlob(canvas);

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success("Image copied to clipboard", { id: toastId });
      } catch {
        // Clipboard images are not supported everywhere, so fall back to a
        // download rather than failing.
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filenameBase}.png`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Image downloaded", { id: toastId });
      }
    } catch (error) {
      toast.dismiss(toastId);
      reportActionError("Could not capture the image", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Share and export"
          className="h-9 gap-2 rounded-lg border-2 border-border bg-transparent px-2.5 font-bold shadow-sm lg:px-3"
          variant="outline"
        >
          <Share2 aria-hidden="true" className="h-4 w-4" />
          <span className="hidden lg:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border-2 border-border"
      >
        <DropdownMenuItem onSelect={copyLink}>
          <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
          Copy link
        </DropdownMenuItem>
        {supportsNativeShare && (
          <DropdownMenuItem onSelect={shareNative}>
            <Share aria-hidden="true" className="mr-2 h-4 w-4" />
            Share via…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs uppercase">
          Export
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={captureAsImage}>
          <ImageIcon aria-hidden="true" className="mr-2 h-4 w-4" />
          Copy as image
        </DropdownMenuItem>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
