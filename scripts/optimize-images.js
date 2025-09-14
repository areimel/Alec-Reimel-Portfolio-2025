#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  opengraph: {
    width: 1200,
    height: 628,
    quality: 85,
    compressionLevel: 8
  },
  general: {
    maxWidth: 1920,
    quality: 80,
    compressionLevel: 6
  }
};

// Helper function to format file sizes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Get file size
function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}

// Create backup of original file
function createBackup(filePath) {
  const backupPath = filePath.replace(/(\.[^.]+)$/, '.backup$1');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`📋 Backup created: ${path.basename(backupPath)}`);
  }
}

// Optimize OpenGraph image specifically
async function optimizeOpenGraphImage(inputPath, outputPath = null) {
  const actualOutputPath = outputPath || inputPath;
  const originalSize = getFileSize(inputPath);

  console.log(`🖼️  Optimizing OpenGraph image: ${path.basename(inputPath)}`);
  console.log(`📏 Target dimensions: ${CONFIG.opengraph.width}x${CONFIG.opengraph.height}`);

  // Create backup if optimizing in place
  if (!outputPath) {
    createBackup(inputPath);
  }

  try {
    await sharp(inputPath)
      .resize(CONFIG.opengraph.width, CONFIG.opengraph.height, {
        fit: 'cover',
        position: 'left top'
      })
      .png({
        quality: CONFIG.opengraph.quality,
        compressionLevel: CONFIG.opengraph.compressionLevel,
        progressive: true
      })
      .toFile(actualOutputPath + '.tmp');

    // Replace original with optimized version
    fs.renameSync(actualOutputPath + '.tmp', actualOutputPath);

    const newSize = getFileSize(actualOutputPath);
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    console.log(`✅ Optimized successfully!`);
    console.log(`📊 Size: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${reduction}% reduction)`);

    return { originalSize, newSize, reduction };
  } catch (error) {
    console.error(`❌ Error optimizing ${path.basename(inputPath)}:`, error.message);
    throw error;
  }
}

// Optimize general image
async function optimizeGeneralImage(inputPath, outputPath = null) {
  const actualOutputPath = outputPath || inputPath;
  const originalSize = getFileSize(inputPath);
  const ext = path.extname(inputPath).toLowerCase();

  console.log(`🖼️  Optimizing image: ${path.basename(inputPath)}`);

  // Create backup if optimizing in place
  if (!outputPath) {
    createBackup(inputPath);
  }

  try {
    let pipeline = sharp(inputPath);

    // Get original dimensions
    const metadata = await pipeline.metadata();
    console.log(`📏 Original dimensions: ${metadata.width}x${metadata.height}`);

    // Resize if larger than maxWidth
    if (metadata.width > CONFIG.general.maxWidth) {
      pipeline = pipeline.resize(CONFIG.general.maxWidth, null, {
        withoutEnlargement: true
      });
      console.log(`📐 Resizing to max width: ${CONFIG.general.maxWidth}px`);
    }

    // Apply format-specific optimization
    switch (ext) {
      case '.png':
        pipeline = pipeline.png({
          quality: CONFIG.general.quality,
          compressionLevel: CONFIG.general.compressionLevel,
          progressive: true
        });
        break;
      case '.jpg':
      case '.jpeg':
        pipeline = pipeline.jpeg({
          quality: CONFIG.general.quality,
          progressive: true
        });
        break;
      case '.webp':
        pipeline = pipeline.webp({
          quality: CONFIG.general.quality
        });
        break;
      default:
        console.log(`⚠️  Unsupported format: ${ext}`);
        return null;
    }

    await pipeline.toFile(actualOutputPath + '.tmp');

    // Replace original with optimized version
    fs.renameSync(actualOutputPath + '.tmp', actualOutputPath);

    const newSize = getFileSize(actualOutputPath);
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    console.log(`✅ Optimized successfully!`);
    console.log(`📊 Size: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${reduction}% reduction)`);

    return { originalSize, newSize, reduction };
  } catch (error) {
    console.error(`❌ Error optimizing ${path.basename(inputPath)}:`, error.message);
    throw error;
  }
}

// Batch optimize images in a directory
async function optimizeDirectory(dirPath, pattern = /\.(jpe?g|png|webp)$/i, isOpenGraph = false) {
  const files = fs.readdirSync(dirPath)
    .filter(file => pattern.test(file))
    .map(file => path.join(dirPath, file));

  if (files.length === 0) {
    console.log(`📁 No images found in ${dirPath}`);
    return;
  }

  console.log(`🚀 Starting batch optimization of ${files.length} images in ${dirPath}`);

  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let successCount = 0;

  for (const filePath of files) {
    try {
      const result = isOpenGraph
        ? await optimizeOpenGraphImage(filePath)
        : await optimizeGeneralImage(filePath);

      if (result) {
        totalOriginalSize += result.originalSize;
        totalNewSize += result.newSize;
        successCount++;
      }
      console.log(''); // Empty line for readability
    } catch (error) {
      console.error(`Failed to optimize ${path.basename(filePath)}`);
    }
  }

  if (successCount > 0) {
    const totalReduction = ((totalOriginalSize - totalNewSize) / totalOriginalSize * 100).toFixed(1);
    console.log(`🎉 Batch optimization complete!`);
    console.log(`📊 Total: ${formatBytes(totalOriginalSize)} → ${formatBytes(totalNewSize)} (${totalReduction}% reduction)`);
    console.log(`✅ Successfully optimized ${successCount}/${files.length} images`);
  }
}

// Main function to handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const projectRoot = path.resolve(__dirname, '..');
  const publicDir = path.join(projectRoot, 'public');
  const previewPath = path.join(publicDir, 'preview.png');

  try {
    switch (command) {
      case 'preview':
        if (!fs.existsSync(previewPath)) {
          console.error(`❌ Preview image not found: ${previewPath}`);
          process.exit(1);
        }
        await optimizeOpenGraphImage(previewPath);
        break;

      case 'og':
      case 'opengraph':
        await optimizeDirectory(publicDir, /\.(png|jpe?g)$/i, true);
        break;

      case 'all':
      case 'batch':
        await optimizeDirectory(publicDir);
        break;

      case 'file':
        const filePath = args[1];
        if (!filePath) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }

        if (!fs.existsSync(filePath)) {
          console.error(`❌ File not found: ${filePath}`);
          process.exit(1);
        }

        const isOg = args.includes('--og') || args.includes('--opengraph');
        if (isOg) {
          await optimizeOpenGraphImage(filePath);
        } else {
          await optimizeGeneralImage(filePath);
        }
        break;

      default:
        console.log(`🖼️  Image Optimization Tool`);
        console.log(`\nUsage: node scripts/optimize-images.js [command] [options]\n`);
        console.log(`Commands:`);
        console.log(`  preview              Optimize /public/preview.png for OpenGraph`);
        console.log(`  og, opengraph        Optimize all images in /public for OpenGraph`);
        console.log(`  all, batch           Optimize all images in /public (general optimization)`);
        console.log(`  file <path> [--og]   Optimize specific file (use --og for OpenGraph)`);
        console.log(`\nExamples:`);
        console.log(`  node scripts/optimize-images.js preview`);
        console.log(`  node scripts/optimize-images.js file ./public/hero.png --og`);
        console.log(`  node scripts/optimize-images.js all`);
        break;
    }
  } catch (error) {
    console.error('❌ Optimization failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();