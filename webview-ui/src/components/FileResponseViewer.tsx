import { AlertTriangle, Download, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { formatFileSize } from '../lib/requestBody';
import { ResponseSummaryBar } from './ResponseSummaryBar';
import type { FileResponseMetadata } from '../types';
import { useVsCodeApi } from '../hooks/useVsCodeApi';

interface FileResponseViewerProps {
  fileResponse: FileResponseMetadata;
  statusCode: number;
  statusText: string;
  durationMs: number;
}

export function FileResponseViewer({
  fileResponse,
  statusCode,
  statusText,
  durationMs,
}: FileResponseViewerProps) {
  const { postMessage } = useVsCodeApi();
  const [previewFailed, setPreviewFailed] = useState(false);

  const fileExists = fileResponse.fileExists ?? fileResponse.stored;
  const isImage =
    !previewFailed &&
    Boolean(fileResponse.previewUri) &&
    fileResponse.contentType.startsWith('image/');

  const handleDownload = () => {
    postMessage({
      type: 'saveDownloadFile',
      downloadPath: fileResponse.downloadPath,
      fileName: fileResponse.fileName,
    });
  };

  const handleReveal = () => {
    postMessage({
      type: 'revealDownloadFile',
      downloadPath: fileResponse.downloadPath,
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0 text-sm">
        <ResponseSummaryBar
          statusCode={statusCode}
          statusText={statusText}
          durationMs={durationMs}
          responseSizeBytes={fileResponse.size}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!fileExists ? (
          <div className="rounded border border-border bg-card p-4 max-w-lg">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium text-sm">Downloaded file not found</div>
                <div className="text-xs text-muted-foreground mt-1">
                  The file may have been deleted manually.
                </div>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <MetadataRow label="Name" value={fileResponse.fileName} />
              <MetadataRow label="Type" value={fileResponse.contentType} />
              <MetadataRow label="Size" value={formatFileSize(fileResponse.size)} />
            </dl>
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <div className="text-sm font-medium">File Downloaded</div>
            {fileResponse.ephemeral && (
              <p className="text-xs text-muted-foreground">
                Session only — enable REC before sending to keep this download in history.
              </p>
            )}

            {isImage && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Image Preview
                </div>
                <div className="rounded border border-border bg-background p-2">
                  <img
                    src={fileResponse.previewUri}
                    alt={fileResponse.fileName}
                    className="max-w-full max-h-80 object-contain mx-auto"
                    onError={() => setPreviewFailed(true)}
                  />
                </div>
              </div>
            )}

            <dl className="space-y-2 text-sm">
              <MetadataRow label="Name" value={fileResponse.fileName} />
              <MetadataRow label="Type" value={fileResponse.contentType} />
              <MetadataRow label="Size" value={formatFileSize(fileResponse.size)} />
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={handleReveal}
                className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent inline-flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Reveal in Folder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs break-all">{value}</dd>
    </div>
  );
}
