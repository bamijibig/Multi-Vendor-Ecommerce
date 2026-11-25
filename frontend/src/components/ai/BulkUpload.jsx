import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { aiApi } from '../../services/ai';
import { Alert } from '../ui/Ui';
import { getErrorMessage } from '../../services/api';

const IMAGE_SOURCE_LABELS = {
  zip: 'ZIP Match',
  excel_url: 'Excel URL',
  ai: 'AI Generated',
  none: 'No image',
};

function Dropzone({ label, accept, file, onFile, hint }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const next = event.dataTransfer.files?.[0];
        if (next) onFile(next);
      }}
      className={`rounded-xl border-2 border-dashed p-5 text-center transition ${
        dragging ? 'border-brand bg-brand-light/40' : 'border-line bg-slate-50'
      }`}
    >
      <Upload className="mx-auto h-6 w-6 text-slate-400" />
      <p className="mt-2 text-sm font-medium text-navy">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn-outline mt-3"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) onFile(next);
        }}
      />
      {file && (
        <p className="mt-3 truncate text-xs font-medium text-emerald-700">
          {file.name}
        </p>
      )}
    </div>
  );
}

export default function BulkUpload({ store, onPublished }) {
  const [excelFile, setExcelFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [toggles, setToggles] = useState({
    auto_generate_description: false,
    auto_suggest_price: false,
    auto_generate_image: false,
  });
  const [uploading, setUploading] = useState(false);
  const [batch, setBatch] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approving, setApproving] = useState(false);

  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadBatch = useCallback(async (id) => {
    const data = await aiApi.bulkBatch(id);
    setBatch(data.batch);
    setDrafts(data.drafts || []);
    return data.batch;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function downloadTemplate() {
    setError('');
    try {
      const blob = await aiApi.bulkTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ai-bulk-product-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not download the template.'));
    }
  }

  async function startPolling(id) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const next = await loadBatch(id);
        if (next && !['PENDING', 'PROCESSING'].includes(next.status)) {
          stopPolling();
        }
      } catch (err) {
        stopPolling();
        setError(getErrorMessage(err, 'Could not refresh batch status.'));
      }
    }, 1500);
  }

  async function upload() {
    if (!excelFile) {
      setError('Choose an Excel file first.');
      return;
    }
    if (!store?.id) {
      setError('Create a store before bulk uploading.');
      return;
    }
    setError('');
    setNotice('');
    setUploading(true);
    stopPolling();
    try {
      const data = await aiApi.bulkUpload({
        excel_file: excelFile,
        images_zip: zipFile || undefined,
        store_id: store.id,
        ...toggles,
      });
      setBatch(data.batch);
      setDrafts([]);
      await loadBatch(data.batch.id);
      startPolling(data.batch.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Bulk upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  async function approveAll() {
    if (!batch?.id) return;
    setApproving(true);
    setError('');
    try {
      const data = await aiApi.approveBulkBatch(batch.id);
      setNotice(
        `Published ${data.published_count} product(s); ${data.skipped_count} skipped.`
      );
      await loadBatch(batch.id);
      onPublished?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not approve the batch.'));
    } finally {
      setApproving(false);
    }
  }

  const processing = batch && ['PENDING', 'PROCESSING'].includes(batch.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <FileSpreadsheet className="h-4 w-4 text-brand" /> Bulk upload (Excel + AI)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload many products at once. ZIP images are matched by SKU; AI fills
            only blank fields when enabled.
          </p>
        </div>
        <button type="button" onClick={downloadTemplate} className="btn-outline">
          <Download className="h-4 w-4" /> Download template
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Dropzone
          label="Excel workbook (.xlsx)"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          file={excelFile}
          onFile={setExcelFile}
          hint="Required columns: title, category, stock_quantity."
        />
        <Dropzone
          label="Image archive (.zip, optional)"
          accept=".zip,application/zip"
          file={zipFile}
          onFile={setZipFile}
          hint="Name files <sku>.jpg or <sku>_1.jpg for gallery images."
        />
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium text-navy">AI enrichment toggles</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ['auto_generate_description', 'Generate missing descriptions'],
            ['auto_suggest_price', 'Suggest missing prices'],
            ['auto_generate_image', 'Generate missing images'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={toggles[key]}
                onChange={(event) =>
                  setToggles((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <button
        type="button"
        onClick={upload}
        disabled={uploading || !store?.id}
        className="btn-primary"
      >
        {uploading ? 'Uploading…' : 'Start bulk upload'}
      </button>

      {batch && (
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-navy">Batch #{batch.id}</p>
              <p className="text-xs text-slate-500">
                Status: {batch.status} · {batch.processed_rows}/{batch.total_rows}{' '}
                processed · {batch.failed_rows} failed
              </p>
            </div>
            {processing && (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            )}
          </div>

          {Array.isArray(batch.error_report) && batch.error_report.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Row errors and warnings</p>
              <ul className="mt-2 space-y-1">
                {batch.error_report.slice(0, 20).map((item, index) => (
                  <li key={index}>
                    Row {item.row || 'file'}{item.sku ? ` (${item.sku})` : ''}:{' '}
                    {[...(item.errors || []), ...(item.warnings || [])].join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {drafts.length > 0 && (
            <>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Draft</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Stock</th>
                      <th className="px-3 py-2">Image</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {drafts.map((draft) => (
                      <tr key={draft.id}>
                        <td className="px-3 py-2 font-medium text-navy">
                          {draft.title}
                        </td>
                        <td className="px-3 py-2">{draft.price ?? '—'}</td>
                        <td className="px-3 py-2">{draft.stock}</td>
                        <td className="px-3 py-2">
                          <span className="badge bg-slate-100 text-slate-700">
                            {IMAGE_SOURCE_LABELS[draft.image_source] ||
                              draft.image_source ||
                              'No image'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{draft.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={approveAll}
                disabled={approving || processing}
                className="btn-primary"
              >
                {approving ? 'Publishing…' : 'Approve & publish all valid products'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
