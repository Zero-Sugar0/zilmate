import { execFile } from 'node:child_process';
import { existsSync, createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';
import { resolveWorkspaceRoot } from '../workspace/paths.js';

const execFileAsync = promisify(execFile);

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.mp4': return 'video/mp4';
    case '.json': return 'application/json';
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js':
    case '.mjs': return 'text/javascript';
    case '.pdf': return 'application/pdf';
    case '.txt': return 'text/plain';
    case '.xml': return 'application/xml';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

export const cloudTools = {
  listCloudBucket: tool({
    description: 'List, explore, and search files inside a remote cloud bucket/store (AWS S3, Google Cloud Storage, or Vercel Blob). Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      provider: z.enum(['s3', 'gcs', 'vercel-blob']).describe('The cloud storage provider.'),
      bucketName: z.string().optional().describe('The name of the bucket (required for S3 and GCS, ignored for Vercel Blob).'),
      prefix: z.string().optional().describe('An optional prefix or folder path to filter files (e.g. "backups/").'),
      limit: z.number().int().min(1).max(5000).optional().default(100).describe('Maximum number of files to list.'),
    }),
    execute: async ({ provider, bucketName, prefix, limit }) => {
      emitProgress({ type: 'fetch:start', label: `Listing ${provider} bucket`, detail: bucketName || 'vercel-blob' });

      if (provider !== 'vercel-blob' && !bucketName) {
        emitProgress({ type: 'fetch:end', label: 'Cloud list failed', detail: 'Bucket name required' });
        return { error: `Bucket name is required for provider "${provider}".` };
      }

      // TIER 1: Official Node.js SDKs
      if (provider === 's3') {
        try {
          const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
          emitProgress({ type: 'step', label: 'Using S3 SDK' });
          const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          const command = new ListObjectsV2Command({
            Bucket: bucketName!,
            Prefix: prefix,
            MaxKeys: limit,
          });

          const response = await client.send(command);
          const files = (response.Contents || []).map((item) => ({
            key: item.Key || '',
            size: item.Size || 0,
            lastModified: item.LastModified ? item.LastModified.toISOString() : '',
            url: `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${item.Key}`,
          }));

          emitProgress({ type: 'fetch:end', label: 'S3 files listed', detail: `Found ${files.length} file(s)` });
          return { provider, bucket: bucketName, files };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'S3 SDK unavailable or failed', detail: sdkError.message });
        }
      } else if (provider === 'gcs') {
        try {
          const { Storage } = await import('@google-cloud/storage');
          emitProgress({ type: 'step', label: 'Using GCS SDK' });
          const storage = new Storage();
          
          const gcsOptions: any = { maxResults: limit };
          if (prefix) {
            gcsOptions.prefix = prefix;
          }

          const [gcsFiles] = await storage.bucket(bucketName!).getFiles(gcsOptions);

          const files = gcsFiles.map((file: any) => ({
            key: file.name,
            size: file.metadata.size ? parseInt(file.metadata.size, 10) : 0,
            lastModified: file.metadata.updated || '',
            url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
          }));

          emitProgress({ type: 'fetch:end', label: 'GCS files listed', detail: `Found ${files.length} file(s)` });
          return { provider, bucket: bucketName, files };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'GCS SDK unavailable or failed', detail: sdkError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          const { list } = await import('@vercel/blob');
          emitProgress({ type: 'step', label: 'Using Vercel Blob SDK' });
          
          const listOptions: any = { limit };
          if (prefix) {
            listOptions.prefix = prefix;
          }
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            listOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
          }

          const response = await list(listOptions);

          const files = response.blobs.map((blob) => ({
            key: blob.pathname,
            size: blob.size,
            lastModified: blob.uploadedAt ? blob.uploadedAt.toISOString() : '',
            url: blob.url,
          }));

          emitProgress({ type: 'fetch:end', label: 'Vercel Blobs listed', detail: `Found ${files.length} files` });
          return { provider, files };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'Vercel Blob SDK unavailable or failed', detail: sdkError.message });
        }
      }

      // TIER 2: Native CLI Fallbacks
      if (provider === 's3' && (await commandExists('aws'))) {
        try {
          emitProgress({ type: 'step', label: 'Falling back to AWS CLI' });
          const s3Uri = `s3://${bucketName}/${prefix || ''}`;
          const { stdout } = await execFileAsync('aws', ['s3', 'ls', s3Uri], { windowsHide: true, timeout: 15000 });
          const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
          
          const files = lines.map((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'PRE') {
              return { key: parts.slice(1).join(' '), size: 0, isFolder: true };
            }
            const lastModified = `${parts[0] || ''} ${parts[1] || ''}`.trim();
            const size = parseInt(parts[2] || '0', 10);
            const key = parts.slice(3).join(' ');
            return {
              key: (prefix || '') + key,
              size,
              lastModified,
              url: `https://${bucketName}.s3.amazonaws.com/${prefix || ''}${key}`,
            };
          });

          emitProgress({ type: 'fetch:end', label: 'S3 files listed (CLI)', detail: `Found ${files.length} item(s)` });
          return { provider, bucket: bucketName, method: 'aws-cli', files };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'AWS CLI fallback failed', detail: cliError.message });
        }
      } else if (provider === 'gcs' && (await commandExists('gsutil'))) {
        try {
          emitProgress({ type: 'step', label: 'Falling back to gsutil CLI' });
          const gcsUri = `gs://${bucketName!}/${prefix || ''}`;
          const { stdout } = await execFileAsync('gsutil', ['ls', '-l', gcsUri], { windowsHide: true, timeout: 15000 });
          const lines = stdout.trim().split(/\r?\n/).filter(Boolean);

          const files = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('TOTAL:')) continue;
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 3) {
              const size = parseInt(parts[0] || '0', 10);
              const lastModified = parts[1] || '';
              const key = parts.slice(2).join(' ').replace(`gs://${bucketName}/`, '');
              files.push({
                key,
                size,
                lastModified,
                url: `https://storage.googleapis.com/${bucketName}/${key}`,
              });
            }
          }

          emitProgress({ type: 'fetch:end', label: 'GCS files listed (gsutil)', detail: `Found ${files.length} item(s)` });
          return { provider, bucket: bucketName, method: 'gsutil', files };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'gsutil fallback failed', detail: cliError.message });
        }
      } else if (provider === 'vercel-blob' && (await commandExists('vercel'))) {
        try {
          emitProgress({ type: 'step', label: 'Falling back to Vercel CLI' });
          const args = ['blob', 'list'];
          if (prefix) args.push('--prefix', prefix);
          if (limit) args.push('--limit', String(limit));

          const { stdout } = await execFileAsync('vercel', args, { windowsHide: true, timeout: 15000 });
          const parsed = JSON.parse(stdout.trim());
          const files = (parsed.blobs || []).map((blob: any) => ({
            key: blob.pathname,
            size: blob.size,
            lastModified: blob.uploadedAt,
            url: blob.url,
          }));

          emitProgress({ type: 'fetch:end', label: 'Vercel Blobs listed (CLI)' });
          return { provider, method: 'vercel-cli', files };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'Vercel CLI fallback failed', detail: cliError.message });
        }
      }

      emitProgress({ type: 'tool:error', label: 'Bucket listing failed', detail: 'No SDK or CLI available' });
      return {
        error: `Failed to list files. Please configure appropriate credentials for "${provider}" or install the "${provider === 'vercel-blob' ? 'vercel' : (provider === 's3' ? 'aws' : 'gcloud')}" CLI utility.`,
      };
    },
  }),

  uploadFileToCloud: tool({
    description: 'Securely upload local files (database dumps, screenshots, or logs) to a remote object store (AWS S3, Google Cloud Storage, or Vercel Blob) with Content-Type preservation. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      provider: z.enum(['s3', 'gcs', 'vercel-blob']).describe('The cloud storage provider.'),
      localFilePath: z.string().min(1).describe('Relative or absolute path to the local file to upload in the workspace.'),
      bucketName: z.string().optional().describe('The name of the bucket (required for S3 and GCS, ignored for Vercel Blob).'),
      destinationKey: z.string().min(1).describe('The destination key/path inside the bucket (e.g., "backups/db.sql").'),
    }),
    execute: async ({ provider, localFilePath, bucketName, destinationKey }) => {
      emitProgress({ type: 'tool:start', label: `Uploading file to ${provider}`, detail: localFilePath });

      const root = resolveWorkspaceRoot();
      const resolvedLocalPath = path.isAbsolute(localFilePath) ? localFilePath : path.join(root, localFilePath);

      if (!existsSync(resolvedLocalPath)) {
        emitProgress({ type: 'tool:error', label: 'Upload failed', detail: 'Local file not found' });
        return { error: `Local file not found at path: ${localFilePath}` };
      }

      if (provider !== 'vercel-blob' && !bucketName) {
        emitProgress({ type: 'tool:error', label: 'Upload failed', detail: 'Bucket name required' });
        return { error: `Bucket name is required for provider "${provider}".` };
      }

      const contentType = detectContentType(resolvedLocalPath);

      // TIER 1: Official Node.js SDKs
      if (provider === 's3') {
        try {
          const { S3Client } = await import('@aws-sdk/client-s3');
          const { Upload } = await import('@aws-sdk/lib-storage');
          emitProgress({ type: 'step', label: 'Uploading using S3 Upload SDK', detail: `ContentType: ${contentType}` });

          const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          const fileStream = createReadStream(resolvedLocalPath);

          const uploader = new Upload({
            client,
            params: {
              Bucket: bucketName!,
              Key: destinationKey,
              Body: fileStream,
              ContentType: contentType,
            },
          });

          await uploader.done();
          const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${destinationKey}`;

          emitProgress({ type: 'tool:end', label: 'S3 upload successful', detail: destinationKey });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: publicUrl, contentType };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'S3 SDK upload failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'gcs') {
        try {
          const { Storage } = await import('@google-cloud/storage');
          emitProgress({ type: 'step', label: 'Uploading using GCS SDK', detail: `ContentType: ${contentType}` });

          const storage = new Storage();
          await storage.bucket(bucketName!).upload(resolvedLocalPath, {
            destination: destinationKey,
            metadata: {
              contentType: contentType,
            },
          });

          const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationKey}`;

          emitProgress({ type: 'tool:end', label: 'GCS upload successful', detail: destinationKey });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: publicUrl, contentType };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'GCS SDK upload failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          const { put } = await import('@vercel/blob');
          emitProgress({ type: 'step', label: 'Uploading using Vercel Blob SDK', detail: `ContentType: ${contentType}` });

          const fileBuffer = await readFile(resolvedLocalPath);
          
          const putOptions: any = {
            access: 'public' as const,
            contentType: contentType,
          };
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            putOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
          }

          const response = await put(destinationKey, fileBuffer, putOptions);

          emitProgress({ type: 'tool:end', label: 'Vercel Blob upload successful', detail: destinationKey });
          return { success: true, provider, key: response.pathname, url: response.url, contentType };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'Vercel Blob SDK upload failed or unavailable', detail: sdkError.message });
        }
      }

      // TIER 2: Native CLI Fallbacks
      if (provider === 's3' && (await commandExists('aws'))) {
        try {
          emitProgress({ type: 'step', label: 'Uploading using AWS CLI cp' });
          const s3Uri = `s3://${bucketName}/${destinationKey}`;
          await execFileAsync('aws', ['s3', 'cp', resolvedLocalPath, s3Uri, '--content-type', contentType], { windowsHide: true, timeout: 60000 });
          const publicUrl = `https://${bucketName}.s3.amazonaws.com/${destinationKey}`;

          emitProgress({ type: 'tool:end', label: 'S3 upload successful (CLI)' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: publicUrl, contentType, method: 'aws-cli' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'AWS CLI cp upload failed', detail: cliError.message });
        }
      } else if (provider === 'gcs' && (await commandExists('gsutil'))) {
        try {
          emitProgress({ type: 'step', label: 'Uploading using gsutil CLI cp' });
          const gcsUri = `gs://${bucketName!}/${destinationKey}`;
          // Set header with -h
          await execFileAsync('gsutil', ['-h', `Content-Type:${contentType}`, 'cp', resolvedLocalPath, gcsUri], { windowsHide: true, timeout: 60000 });
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationKey}`;

          emitProgress({ type: 'tool:end', label: 'GCS upload successful (CLI)' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: publicUrl, contentType, method: 'gsutil' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'gsutil cp upload failed', detail: cliError.message });
        }
      } else if (provider === 'vercel-blob' && (await commandExists('vercel'))) {
        try {
          emitProgress({ type: 'step', label: 'Uploading using Vercel CLI put' });
          const { stdout } = await execFileAsync('vercel', ['blob', 'put', resolvedLocalPath], { windowsHide: true, timeout: 60000 });
          
          const matchedUrl = stdout.trim().match(/https:\/\/\S+/);
          const publicUrl = matchedUrl ? (matchedUrl[0] || stdout.trim()) : stdout.trim();

          emitProgress({ type: 'tool:end', label: 'Vercel Blob upload successful (CLI)' });
          return { success: true, provider, key: destinationKey, url: publicUrl, method: 'vercel-cli' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'Vercel CLI put upload failed', detail: cliError.message });
        }
      }

      emitProgress({ type: 'tool:error', label: 'Upload failed', detail: 'No SDK or CLI available' });
      return {
        error: `Failed to upload file. Please configure appropriate credentials for "${provider}" or install the "${provider === 'vercel-blob' ? 'vercel' : (provider === 's3' ? 'aws' : 'gcloud')}" CLI utility.`,
      };
    },
  }),

  downloadFileFromCloud: tool({
    description: 'Download a remote file from cloud storage (AWS S3, Google Cloud Storage, or Vercel Blob) directly to a local workspace path. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      provider: z.enum(['s3', 'gcs', 'vercel-blob']).describe('The cloud storage provider.'),
      bucketName: z.string().optional().describe('The name of the bucket (required for S3 and GCS, ignored for Vercel Blob).'),
      destinationKey: z.string().min(1).describe('The remote key or pathname of the file to download (or a full HTTPS URL for Vercel Blob).'),
      localFilePath: z.string().min(1).describe('The local destination path in the workspace (relative or absolute).'),
    }),
    execute: async ({ provider, bucketName, destinationKey, localFilePath }) => {
      emitProgress({ type: 'tool:start', label: `Downloading file from ${provider}`, detail: destinationKey });

      const root = resolveWorkspaceRoot();
      const resolvedLocalPath = path.isAbsolute(localFilePath) ? localFilePath : path.join(root, localFilePath);

      const outputDir = path.dirname(resolvedLocalPath);
      if (!existsSync(outputDir)) {
        const fs = await import('node:fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
      }

      if (provider !== 'vercel-blob' && !bucketName) {
        emitProgress({ type: 'tool:error', label: 'Download failed', detail: 'Bucket name required' });
        return { error: `Bucket name is required for provider "${provider}".` };
      }

      const { createWriteStream } = await import('node:fs');
      const { pipeline } = await import('node:stream/promises');

      // TIER 1: Official Node.js SDKs
      if (provider === 's3') {
        try {
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
          emitProgress({ type: 'step', label: 'Downloading using S3 SDK GetObject' });

          const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          const command = new GetObjectCommand({
            Bucket: bucketName!,
            Key: destinationKey,
          });

          const response = await client.send(command);
          const body = response.Body;
          if (!body) {
            throw new Error('S3 GetObject returned an empty body.');
          }

          const fileStream = createWriteStream(resolvedLocalPath);
          await pipeline(body as any, fileStream);

          emitProgress({ type: 'tool:end', label: 'S3 download successful', detail: resolvedLocalPath });
          return { success: true, provider, bucket: bucketName, key: destinationKey, localPath: resolvedLocalPath };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'S3 SDK download failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'gcs') {
        try {
          const { Storage } = await import('@google-cloud/storage');
          emitProgress({ type: 'step', label: 'Downloading using GCS SDK' });

          const storage = new Storage();
          await storage.bucket(bucketName!).file(destinationKey).download({
            destination: resolvedLocalPath,
          });

          emitProgress({ type: 'tool:end', label: 'GCS download successful', detail: resolvedLocalPath });
          return { success: true, provider, bucket: bucketName, key: destinationKey, localPath: resolvedLocalPath };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'GCS SDK download failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          const { list } = await import('@vercel/blob');
          emitProgress({ type: 'step', label: 'Downloading using Vercel Blob API' });

          let downloadUrl = destinationKey;
          if (!destinationKey.startsWith('http://') && !destinationKey.startsWith('https://')) {
            const listOptions: any = { limit: 10, prefix: destinationKey };
            if (process.env.BLOB_READ_WRITE_TOKEN) {
              listOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
            }
            const response = await list(listOptions);
            const matched = response.blobs.find(b => b.pathname === destinationKey);
            if (matched) {
              downloadUrl = matched.url;
            } else {
              throw new Error(`No Vercel Blob found with pathname "${destinationKey}".`);
            }
          }

          const res = await fetch(downloadUrl);
          if (!res.ok) {
            throw new Error(`Failed to fetch Vercel Blob: HTTP ${res.status} ${res.statusText}`);
          }
          if (!res.body) {
            throw new Error('Vercel Blob fetch body is empty.');
          }

          const { Readable } = await import('node:stream');
          const fileStream = createWriteStream(resolvedLocalPath);
          await pipeline(Readable.fromWeb(res.body as any), fileStream);

          emitProgress({ type: 'tool:end', label: 'Vercel Blob download successful', detail: resolvedLocalPath });
          return { success: true, provider, url: downloadUrl, localPath: resolvedLocalPath };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'Vercel Blob download failed or unavailable', detail: sdkError.message });
        }
      }

      // TIER 2: Native CLI Fallbacks
      if (provider === 's3' && (await commandExists('aws'))) {
        try {
          emitProgress({ type: 'step', label: 'Downloading using AWS CLI cp' });
          const s3Uri = `s3://${bucketName}/${destinationKey}`;
          await execFileAsync('aws', ['s3', 'cp', s3Uri, resolvedLocalPath], { windowsHide: true, timeout: 60000 });

          emitProgress({ type: 'tool:end', label: 'S3 download successful (CLI)', detail: resolvedLocalPath });
          return { success: true, provider, bucket: bucketName, key: destinationKey, localPath: resolvedLocalPath, method: 'aws-cli' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'AWS CLI cp download failed', detail: cliError.message });
        }
      } else if (provider === 'gcs' && (await commandExists('gsutil'))) {
        try {
          emitProgress({ type: 'step', label: 'Downloading using gsutil CLI cp' });
          const gcsUri = `gs://${bucketName!}/${destinationKey}`;
          await execFileAsync('gsutil', ['cp', gcsUri, resolvedLocalPath], { windowsHide: true, timeout: 60000 });

          emitProgress({ type: 'tool:end', label: 'GCS download successful (CLI)', detail: resolvedLocalPath });
          return { success: true, provider, bucket: bucketName, key: destinationKey, localPath: resolvedLocalPath, method: 'gsutil' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'gsutil cp download failed', detail: cliError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          emitProgress({ type: 'step', label: 'Downloading using native HTTP fetch fallback' });
          let downloadUrl = destinationKey;
          if (!destinationKey.startsWith('http://') && !destinationKey.startsWith('https://')) {
            throw new Error('Vercel CLI fallback requires a full blob HTTP URL for downloading.');
          }

          const res = await fetch(downloadUrl);
          if (!res.ok) {
            throw new Error(`Fetch failed: HTTP ${res.status}`);
          }
          if (!res.body) {
            throw new Error('Empty response body.');
          }

          const { Readable } = await import('node:stream');
          const fileStream = createWriteStream(resolvedLocalPath);
          await pipeline(Readable.fromWeb(res.body as any), fileStream);

          emitProgress({ type: 'tool:end', label: 'Vercel Blob download successful (HTTP fetch)' });
          return { success: true, provider, url: downloadUrl, localPath: resolvedLocalPath, method: 'http-fetch' };
        } catch (fetchError: any) {
          emitProgress({ type: 'step', label: 'HTTP fetch fallback failed', detail: fetchError.message });
        }
      }

      emitProgress({ type: 'tool:error', label: 'Download failed', detail: 'No SDK or CLI available' });
      return {
        error: `Failed to download file. Please configure appropriate credentials for "${provider}" or install the "${provider === 'vercel-blob' ? 'vercel' : (provider === 's3' ? 'aws' : 'gcloud')}" CLI utility.`,
      };
    },
  }),

  deleteCloudFile: tool({
    description: 'Delete a file or recursively purge directories from cloud storage (AWS S3, Google Cloud Storage, or Vercel Blob). Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      provider: z.enum(['s3', 'gcs', 'vercel-blob']).describe('The cloud storage provider.'),
      bucketName: z.string().optional().describe('The name of the bucket (required for S3 and GCS, ignored for Vercel Blob).'),
      destinationKey: z.string().min(1).describe('The remote key, pathname, or directory prefix to delete.'),
      recursive: z.boolean().optional().describe('If true, performs a recursive deletion of all nested objects under this path/prefix.'),
    }),
    execute: async ({ provider, bucketName, destinationKey, recursive }) => {
      emitProgress({ type: 'tool:start', label: `Deleting from ${provider}`, detail: `${destinationKey}${recursive ? ' (recursively)' : ''}` });

      if (provider !== 'vercel-blob' && !bucketName) {
        emitProgress({ type: 'tool:error', label: 'Delete failed', detail: 'Bucket name required' });
        return { error: `Bucket name is required for provider "${provider}".` };
      }

      // TIER 1: Official Node.js SDKs
      if (provider === 's3') {
        try {
          const { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
          emitProgress({ type: 'step', label: 'Deleting using S3 SDK' });

          const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

          if (recursive) {
            emitProgress({ type: 'step', label: 'Listing objects for recursive S3 delete' });
            const listCommand = new ListObjectsV2Command({
              Bucket: bucketName!,
              Prefix: destinationKey,
            });
            const listRes = await client.send(listCommand);
            const contents = listRes.Contents || [];
            
            if (contents.length === 0) {
              emitProgress({ type: 'tool:end', label: 'S3 recursive delete completed', detail: '0 objects found' });
              return { success: true, provider, bucket: bucketName, deletedCount: 0 };
            }

            // AWS supports batch deletion up to 1000 objects
            const deleteCommand = new DeleteObjectsCommand({
              Bucket: bucketName!,
              Delete: {
                Objects: contents.map(item => ({ Key: item.Key! })),
                Quiet: true,
              },
            });
            await client.send(deleteCommand);
            emitProgress({ type: 'tool:end', label: 'S3 recursive delete successful', detail: `${contents.length} objects` });
            return { success: true, provider, bucket: bucketName, deletedCount: contents.length };
          } else {
            const command = new DeleteObjectCommand({
              Bucket: bucketName!,
              Key: destinationKey,
            });
            await client.send(command);
            emitProgress({ type: 'tool:end', label: 'S3 delete successful', detail: destinationKey });
            return { success: true, provider, bucket: bucketName, key: destinationKey };
          }
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'S3 SDK delete failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'gcs') {
        try {
          const { Storage } = await import('@google-cloud/storage');
          emitProgress({ type: 'step', label: 'Deleting using GCS SDK' });

          const storage = new Storage();
          const bucket = storage.bucket(bucketName!);

          if (recursive) {
            emitProgress({ type: 'step', label: 'Purging GCS prefix recursively' });
            await bucket.deleteFiles({ prefix: destinationKey });
            emitProgress({ type: 'tool:end', label: 'GCS recursive delete successful', detail: destinationKey });
            return { success: true, provider, bucket: bucketName, prefix: destinationKey, recursive: true };
          } else {
            await bucket.file(destinationKey).delete();
            emitProgress({ type: 'tool:end', label: 'GCS delete successful', detail: destinationKey });
            return { success: true, provider, bucket: bucketName, key: destinationKey };
          }
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'GCS SDK delete failed or unavailable', detail: sdkError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          const { list, del } = await import('@vercel/blob');
          emitProgress({ type: 'step', label: 'Deleting using Vercel Blob SDK' });

          const delOptions: any = {};
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            delOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
          }

          if (recursive) {
            emitProgress({ type: 'step', label: 'Listing blobs for recursive Vercel Blob delete' });
            const listRes = await list({ prefix: destinationKey, ...delOptions });
            const urls = listRes.blobs.map(b => b.url);
            
            if (urls.length === 0) {
              emitProgress({ type: 'tool:end', label: 'Vercel Blob recursive delete completed', detail: '0 objects found' });
              return { success: true, provider, deletedCount: 0 };
            }

            await del(urls, delOptions);
            emitProgress({ type: 'tool:end', label: 'Vercel Blob recursive delete successful', detail: `${urls.length} files` });
            return { success: true, provider, deletedCount: urls.length };
          } else {
            let deleteUrl = destinationKey;
            if (!destinationKey.startsWith('http://') && !destinationKey.startsWith('https://')) {
              const response = await list({ prefix: destinationKey, limit: 10, ...delOptions });
              const matched = response.blobs.find(b => b.pathname === destinationKey);
              if (matched) {
                deleteUrl = matched.url;
              } else {
                throw new Error(`No Vercel Blob found with pathname "${destinationKey}".`);
              }
            }
            await del(deleteUrl, delOptions);
            emitProgress({ type: 'tool:end', label: 'Vercel Blob delete successful', detail: deleteUrl });
            return { success: true, provider, url: deleteUrl };
          }
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'Vercel Blob SDK delete failed or unavailable', detail: sdkError.message });
        }
      }

      // TIER 2: Native CLI Fallbacks
      if (provider === 's3' && (await commandExists('aws'))) {
        try {
          emitProgress({ type: 'step', label: 'Deleting using AWS CLI' });
          const s3Uri = `s3://${bucketName}/${destinationKey}`;
          const args = ['s3', 'rm', s3Uri];
          if (recursive) {
            args.push('--recursive');
          }
          await execFileAsync('aws', args, { windowsHide: true, timeout: 30000 });

          emitProgress({ type: 'tool:end', label: 'S3 delete successful (CLI)' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, recursive, method: 'aws-cli' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'AWS CLI rm delete failed', detail: cliError.message });
        }
      } else if (provider === 'gcs' && (await commandExists('gsutil'))) {
        try {
          emitProgress({ type: 'step', label: 'Deleting using gsutil CLI' });
          const gcsUri = `gs://${bucketName!}/${destinationKey}`;
          const args = ['rm'];
          if (recursive) {
            args.push('-r');
          }
          args.push(gcsUri);
          await execFileAsync('gsutil', args, { windowsHide: true, timeout: 30000 });

          emitProgress({ type: 'tool:end', label: 'GCS delete successful (CLI)' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, recursive, method: 'gsutil' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'gsutil rm delete failed', detail: cliError.message });
        }
      } else if (provider === 'vercel-blob' && (await commandExists('vercel'))) {
        try {
          emitProgress({ type: 'step', label: 'Deleting using Vercel CLI blob delete' });
          if (recursive) {
            throw new Error('Vercel CLI fallback does not support recursive deletion. Please use SDK.');
          }
          let deleteUrl = destinationKey;
          if (!destinationKey.startsWith('http://') && !destinationKey.startsWith('https://')) {
            throw new Error('Vercel CLI fallback requires a full blob HTTP URL for deleting.');
          }
          await execFileAsync('vercel', ['blob', 'delete', deleteUrl], { windowsHide: true, timeout: 20000 });

          emitProgress({ type: 'tool:end', label: 'Vercel Blob delete successful (CLI)', detail: deleteUrl });
          return { success: true, provider, url: deleteUrl, method: 'vercel-cli' };
        } catch (cliError: any) {
          emitProgress({ type: 'step', label: 'Vercel CLI delete failed', detail: cliError.message });
        }
      }

      emitProgress({ type: 'tool:error', label: 'Delete failed', detail: 'No SDK or CLI available' });
      return {
        error: `Failed to delete file. Please configure appropriate credentials for "${provider}" or install the "${provider === 'vercel-blob' ? 'vercel' : (provider === 's3' ? 'aws' : 'gcloud')}" CLI utility.`,
      };
    },
  }),

  generateCloudSignedUrl: tool({
    description: 'Generate a temporary pre-signed URL for S3 or GCS to allow secure read/write operations, or return the public URL for Vercel Blob. Highly resilient with local fallback warning systems.',
    inputSchema: z.object({
      provider: z.enum(['s3', 'gcs', 'vercel-blob']).describe('The cloud storage provider.'),
      bucketName: z.string().optional().describe('The name of the bucket (required for S3 and GCS, ignored for Vercel Blob).'),
      destinationKey: z.string().min(1).describe('The remote key or path to sign.'),
      expiresIn: z.number().int().min(1).optional().default(3600).describe('Expiration window in seconds (default 3600 / 1 hour).'),
      operation: z.enum(['read', 'write']).optional().default('read').describe('The allowed access level: "read" (GET) or "write" (PUT). Default is "read".'),
    }),
    execute: async ({ provider, bucketName, destinationKey, expiresIn = 3600, operation = 'read' }) => {
      emitProgress({ type: 'tool:start', label: `Generating signed URL (${operation}) on ${provider}`, detail: destinationKey });

      if (provider !== 'vercel-blob' && !bucketName) {
        emitProgress({ type: 'tool:error', label: 'Signed URL failed', detail: 'Bucket name required' });
        return { error: `Bucket name is required for provider "${provider}".` };
      }

      // S3 presigned URL
      if (provider === 's3') {
        try {
          const { S3Client, GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
          const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

          const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          const command = operation === 'write'
            ? new PutObjectCommand({ Bucket: bucketName!, Key: destinationKey })
            : new GetObjectCommand({ Bucket: bucketName!, Key: destinationKey });

          const signedUrl = await getSignedUrl(client, command as any, { expiresIn });

          emitProgress({ type: 'tool:end', label: 'S3 presigned URL generated successfully' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: signedUrl, operation, expires: expiresIn };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'S3 presigned URL SDK generation failed', detail: sdkError.message });
        }
      } else if (provider === 'gcs') {
        try {
          const { Storage } = await import('@google-cloud/storage');
          const storage = new Storage();
          const bucket = storage.bucket(bucketName!);
          const file = bucket.file(destinationKey);

          const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: operation === 'write' ? 'write' : 'read',
            expires: Date.now() + expiresIn * 1000,
          });

          emitProgress({ type: 'tool:end', label: 'GCS presigned URL generated successfully' });
          return { success: true, provider, bucket: bucketName, key: destinationKey, url: signedUrl, operation, expires: expiresIn };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'GCS presigned URL SDK generation failed', detail: sdkError.message });
        }
      } else if (provider === 'vercel-blob') {
        try {
          const { list } = await import('@vercel/blob');
          emitProgress({ type: 'step', label: 'Resolving Vercel Blob URL' });

          const listOptions: any = { limit: 10, prefix: destinationKey };
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            listOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
          }
          const response = await list(listOptions);
          const matched = response.blobs.find(b => b.pathname === destinationKey);
          const fileUrl = matched ? matched.url : `https://blob.vercel-storage.com/${destinationKey}`;

          emitProgress({ type: 'tool:end', label: 'Vercel Blob resolved' });
          return {
            success: true,
            provider,
            key: destinationKey,
            url: fileUrl,
            note: 'Vercel Blob operates with persistent secure tokens. Temporary S3-style signatures are not applicable, standard URL is returned.',
          };
        } catch (sdkError: any) {
          emitProgress({ type: 'step', label: 'Vercel Blob resolver failed', detail: sdkError.message });
        }
      }

      // Tier 3: Local signature warnings and fallback URL generators
      if (provider === 's3') {
        const fallbackUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${destinationKey}`;
        emitProgress({ type: 'tool:end', label: 'Signed URL fallback constructed' });
        return {
          success: false,
          error: 'Could not generate S3 presigned URL locally. Check AWS credentials.',
          url: fallbackUrl,
        };
      } else if (provider === 'gcs') {
        const fallbackUrl = `https://storage.googleapis.com/${bucketName}/${destinationKey}`;
        emitProgress({ type: 'tool:end', label: 'Signed URL fallback constructed' });
        return {
          success: false,
          error: 'Could not generate GCS presigned URL locally. Check Google credentials.',
          url: fallbackUrl,
        };
      }

      return { error: `Failed to generate a temporary pre-signed URL for provider ${provider}. Check your configurations.` };
    },
  }),
};
