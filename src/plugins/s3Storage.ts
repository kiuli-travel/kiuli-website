// src/plugins/s3Storage.ts
import { s3Storage } from '@payloadcms/storage-s3'

export const makeS3StoragePlugin = () =>
  s3Storage({
    // Apply S3 to your media collection. The slug must match your collection.
    collections: {
      media: true,
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
    // Optional features exist, for example signed downloads and clientUploads.
    // We will leave them off until we verify basic upload works.
  })
