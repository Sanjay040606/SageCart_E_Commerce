import { dirname } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    outputFileTracingRoot: projectRoot,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'raw.githubusercontent.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'assets.myntassets.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'rukminim1.flixcart.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'm.media-amazon.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'images-na.ssl-images-amazon.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'img.lazcdn.com',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'assets.myntassets.com',
                pathname: '/**',
            },
        ],
    },
};

export default nextConfig;
