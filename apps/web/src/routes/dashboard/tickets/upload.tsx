import type { IngestionMode } from "@ppal/contracts/tickets";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { api, calculateSha256 } from "@/lib/api";

type UploadPhase =
  | "idle"
  | "hashing"
  | "uploading"
  | "extracting"
  | "done"
  | "error";

/* oxlint-disable promise/avoid-new */
// eslint-disable-next-line promise/avoid-new
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
/* oxlint-enable promise/avoid-new */

const pollTicketId = async (
  uploadId: string,
  initialTicketId?: string | null
): Promise<string> => {
  if (initialTicketId) {
    return initialTicketId;
  }
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(1500);
    attempts += 1;

    try {
      // eslint-disable-next-line no-await-in-loop
      const currentUpload = await api.uploads.get(uploadId);
      if (currentUpload.upload.ticketId) {
        return currentUpload.upload.ticketId;
      }
      if (currentUpload.upload.status === "failed") {
        throw new Error(currentUpload.upload.error || "Slip parsing failed");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("parsing failed")) {
        throw error;
      }
    }
  }

  const latestTickets = await api.tickets.list({ limit: 5 });
  const matchingTicket = latestTickets.tickets.find(
    (t) => t.sourceUploadId === uploadId
  );
  if (matchingTicket) {
    return matchingTicket.id;
  }
  throw new Error(
    "Slip extraction timed out. Please check your tickets archive."
  );
};

const getProgressBarColor = (phase: UploadPhase) => {
  if (phase === "error") {
    return "bg-rose-500";
  }
  if (phase === "done") {
    return "bg-emerald-400";
  }
  return "animate-pulse bg-emerald-500";
};

const getProgressBarWidth = (phase: UploadPhase) => {
  switch (phase) {
    case "hashing": {
      return "25%";
    }
    case "uploading": {
      return "50%";
    }
    case "extracting": {
      return "80%";
    }
    default: {
      return "100%";
    }
  }
};

const getDropZoneBorderClass = (isDragOver: boolean, hasFile: boolean) => {
  if (isDragOver) {
    return "border-emerald-400 bg-emerald-500/10";
  }
  if (hasFile) {
    return "border-emerald-500/40 bg-zinc-900/80";
  }
  return "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50";
};

const getButtonLabel = (phase: UploadPhase) => {
  if (phase === "extracting") {
    return "Extracting Legs...";
  }
  if (phase === "uploading" || phase === "hashing") {
    return "Processing...";
  }
  return "Extract Legs with AI";
};

const DropZoneContent = ({
  previewUrl,
  selectedFile,
}: {
  previewUrl: string | null;
  selectedFile: File | null;
}) => {
  if (previewUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative max-h-48 max-w-xs overflow-hidden rounded-xl border border-zinc-700 shadow-lg">
          <img
            src={previewUrl}
            alt="Slip preview"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-white">{selectedFile?.name}</p>
          <p className="text-[10px] text-zinc-500">
            {((selectedFile?.size ?? 0) / 1024).toFixed(0)} KB · Click or drop
            another image to replace
          </p>
        </div>
      </div>
    );
  }

  if (selectedFile) {
    return (
      <div className="flex flex-col items-center gap-2">
        <FileText className="size-12 text-emerald-400" />
        <p className="text-xs font-bold text-white">{selectedFile.name}</p>
        <p className="text-[10px] text-zinc-500">
          Click or drop another file to replace
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400">
        <FileUp className="size-7 text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">
          Drag & drop your bet slip screenshot here
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          or click to browse from your device
        </p>
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
        <span>PNG</span>
        <span>·</span>
        <span>JPG</span>
        <span>·</span>
        <span>WEBP</span>
        <span>·</span>
        <span>PDF up to 10MB</span>
      </div>
    </div>
  );
};

const PipelineStatusIcon = ({ phase }: { phase: UploadPhase }) => {
  if (phase === "done") {
    return <CheckCircle2 className="size-5 text-emerald-400" />;
  }
  if (phase === "error") {
    return <AlertCircle className="size-5 text-rose-400" />;
  }
  return <Loader2 className="size-5 animate-spin text-emerald-400" />;
};

const TrackingModePicker = ({
  ingestionMode,
  setIngestionMode,
}: {
  ingestionMode: IngestionMode;
  setIngestionMode: (m: IngestionMode) => void;
}) => (
  <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
    <span className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
      Select Tracking Intent
    </span>
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setIngestionMode("live")}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition ${
          ingestionMode === "live"
            ? "border-emerald-500 bg-emerald-500/10 text-white"
            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
        }`}
      >
        <Zap
          className={`mt-0.5 size-5 shrink-0 ${
            ingestionMode === "live" ? "text-emerald-400" : "text-zinc-500"
          }`}
        />
        <div>
          <p className="text-xs font-bold text-white">Live Tracking Mode</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            For tonight&apos;s or upcoming games. We&apos;ll poll real-time
            Sportradar feeds and push milestone updates as legs hit.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setIngestionMode("historical")}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition ${
          ingestionMode === "historical"
            ? "border-emerald-500 bg-emerald-500/10 text-white"
            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
        }`}
      >
        <CheckCircle2
          className={`mt-0.5 size-5 shrink-0 ${
            ingestionMode === "historical"
              ? "text-emerald-400"
              : "text-zinc-500"
          }`}
        />
        <div>
          <p className="text-xs font-bold text-white">
            Historical / Settled Slip
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Already settled bet slips. Add them to your verified personal win
            rate and public bettor profile scorecard.
          </p>
        </div>
      </button>
    </div>
  </div>
);

const TicketUploadComponent = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>("live");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ];
    if (!validMimes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WebP screenshot or PDF");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10 MB limit");
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setPhase("idle");

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const startUploadAndExtraction = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      setErrorMessage(null);

      // Phase 1: Browser SHA-256 Hashing
      setPhase("hashing");
      setStatusMessage("Calculating cryptographic checksum...");
      const sha256 = await calculateSha256(selectedFile);

      // Phase 2: Create Intent
      setPhase("uploading");
      setStatusMessage("Reserving secure slip intake...");
      const mimeType = selectedFile.type as
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "application/pdf";
      const idempotencyKey = `web_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const { upload, uploadUrl } = await api.uploads.createIntent({
        idempotencyKey,
        ingestionMode,
        mimeType,
        originalFilename: selectedFile.name,
        sha256,
        size: selectedFile.size,
      });

      // Phase 3: Upload content
      setStatusMessage("Vaulting slip image to R2 storage...");
      await api.uploads.uploadContent(uploadUrl, selectedFile);

      // Phase 4: Poll extraction progress
      setPhase("extracting");
      setStatusMessage("AI is scanning slip legs, players, and odds...");

      const resolvedTicketId = await pollTicketId(upload.id, upload.ticketId);

      setPhase("done");
      setStatusMessage("Legs extracted successfully! Redirecting to review...");
      toast.success("Slip extracted! Review your legs now.");

      setTimeout(() => {
        navigate({
          params: { ticketId: resolvedTicketId },
          to: "/dashboard/tickets/$ticketId/review",
        });
      }, 800);
    } catch (error) {
      setPhase("error");
      const msg =
        error instanceof Error ? error.message : "Failed to extract bet slip";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
          AI Intake Engine
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Upload Bet Slip
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Drop in a screenshot from FanDuel, DraftKings, BetMGM, or Caesars.
          Gemini extracts every player, target, and market in seconds.
        </p>
      </div>

      {/* Tracking Mode Picker */}
      <TrackingModePicker
        ingestionMode={ingestionMode}
        setIngestionMode={setIngestionMode}
      />

      {/* Drop Zone */}
      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${getDropZoneBorderClass(
          isDragOver,
          Boolean(selectedFile)
        )}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <DropZoneContent previewUrl={previewUrl} selectedFile={selectedFile} />
      </button>

      {/* Progress / Status Pipeline */}
      {phase !== "idle" && (
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PipelineStatusIcon phase={phase} />
              <span className="text-xs font-bold text-white">
                {statusMessage}
              </span>
            </div>
            <span className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
              Phase: {phase}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all duration-300 ${getProgressBarColor(phase)}`}
              style={{
                width: getProgressBarWidth(phase),
              }}
            />
          </div>

          {errorMessage && (
            <p className="text-xs font-medium text-rose-400">{errorMessage}</p>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            setSelectedFile(null);
            setPreviewUrl(null);
            setPhase("idle");
            setErrorMessage(null);
          }}
          disabled={
            !selectedFile || phase === "uploading" || phase === "extracting"
          }
          className="cursor-pointer text-xs font-semibold text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear File
        </button>

        <button
          type="button"
          disabled={
            !selectedFile ||
            phase === "hashing" ||
            phase === "uploading" ||
            phase === "extracting" ||
            phase === "done"
          }
          onClick={startUploadAndExtraction}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          <span>{getButtonLabel(phase)}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Helpful Tips Card */}
      <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5">
        <span className="text-xs font-bold text-zinc-300">
          Tips for Best OCR Accuracy
        </span>
        <ul className="space-y-1.5 text-xs text-zinc-400">
          <li>
            • Include the sportsbook banner (FanDuel, DraftKings, BetMGM) in the
            screenshot
          </li>
          <li>
            • Make sure all leg lines (player name, over/under, stat line) are
            visible and not cropped
          </li>
          <li>
            • You can manually review and edit any leg before starting live
            tracking
          </li>
        </ul>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/tickets/upload")({
  component: TicketUploadComponent,
});
