import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3ClientConfig } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const endpoint = process.env["R2_ENDPOINT"] ?? process.env["S3_ENDPOINT"];
  const config: S3ClientConfig = {
    region: process.env["S3_REGION"] ?? "auto",
    credentials: {
      accessKeyId: process.env["S3_ACCESS_KEY_ID"] ?? "",
      secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"] ?? "",
    },
    forcePathStyle: !!endpoint,
    ...(endpoint !== undefined && { endpoint }),
  };
  _client = new S3Client(config);
  return _client;
}

const BUCKET = process.env["S3_BUCKET"] ?? "condominio-legal";

export async function generatePresignedUploadUrl(
  key: string,
  contentType = "image/jpeg"
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

export async function generatePresignedDownloadUrl(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: 3600 });
}

export function buildFotoKey(condominioId: string, id: string, prefix = "uploads"): string {
  return `${prefix}/${condominioId}/${id}.jpg`;
}
