// src/plugins/s3Storage.ts
import { s3Storage } from '@payloadcms/storage-s3'

export const makeS3StoragePlugin = () =>
  s3Storage({
    // Apply S3 to your media collection. The slug must match your collection.
    collections: {
      media: {
        // Disable local filesystem storage entirely.
        // Without this, Payload attempts to write to the local filesystem before S3.
        // On Vercel serverless the local write fails intermittently, triggering
        // Payload's internal cleanup which deletes the just-committed DB row while
        // the API response (containing the ID) has already been sent to the caller.
        // Result: phantom media IDs that exist in ImageStatus but not in the DB.
        disableLocalStorage: true,
        generateFileURL: ({ filename }: { filename: string }) => {
          const bucket = process.env.S3_BUCKET
          const region = process.env.S3_REGION
          return `https://${bucket}.s3.${region}.amazonaws.com/media/${filename}`
        },
      },
    },
    // Your S3 bucket name
    bucket: process.env.S3_BUCKET as string,
    // AWS SDK S3 client config
    config: {
      region: process.env.S3_REGION as string,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    },
  })
