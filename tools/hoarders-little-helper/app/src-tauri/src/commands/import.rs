use image::{imageops::FilterType, GenericImageView};
use img_hash::{HasherConfig, ImageHash};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedPhoto {
    pub id:        String,
    pub original:  String,   // absolute path to original (never modified)
    pub thumbnail: String,   // absolute path to 160×160 thumbnail
    pub medium:    String,   // absolute path to 800px medium
    pub phash:     String,   // hex perceptual hash
    pub width:     u32,
    pub height:    u32,
    pub is_blurry: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportError {
    pub path:    String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub photos: Vec<ImportedPhoto>,
    pub errors: Vec<ImportError>,
}

const THUMB_SIZE:  u32 = 160;
const MEDIUM_SIZE: u32 = 800;
// Laplacian variance below this threshold → blurry
const BLUR_THRESHOLD: f64 = 80.0;

/// Import one or more photo files. For each file:
/// 1. Copy the original untouched
/// 2. Generate thumbnail (160×160) and medium (800px longest side)
/// 3. Compute perceptual hash
/// 4. Detect blur via Laplacian variance
///
/// `dest_dir` is the library's `photos/` directory.
#[tauri::command]
pub fn import_photos(paths: Vec<String>, dest_dir: String) -> ImportResult {
    let dest = Path::new(&dest_dir);
    let mut photos = Vec::new();
    let mut errors = Vec::new();

    for path_str in paths {
        match process_photo(&path_str, dest) {
            Ok(photo) => photos.push(photo),
            Err(e)    => errors.push(ImportError { path: path_str, message: e }),
        }
    }

    ImportResult { photos, errors }
}

fn process_photo(path_str: &str, dest: &Path) -> Result<ImportedPhoto, String> {
    let src_path = Path::new(path_str);
    let ext = src_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let id = Uuid::new_v4().to_string();

    // Subdirectory per ID prefix (avoids huge flat directories)
    let sub = &id[..2];
    let dir = dest.join(sub).join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // 1. Copy original
    let original_path = dir.join(format!("original.{ext}"));
    std::fs::copy(src_path, &original_path).map_err(|e| e.to_string())?;

    // 2. Open image
    let img = image::open(&original_path).map_err(|e| e.to_string())?;
    let (width, height) = img.dimensions();

    // 3. Thumbnail
    let thumb = img.resize_to_fill(THUMB_SIZE, THUMB_SIZE, FilterType::Lanczos3);
    let thumb_path = dir.join("thumbnail.jpg");
    thumb.save_with_format(&thumb_path, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    // 4. Medium (preserve aspect ratio)
    let medium = img.resize(MEDIUM_SIZE, MEDIUM_SIZE, FilterType::Lanczos3);
    let medium_path = dir.join("medium.jpg");
    medium.save_with_format(&medium_path, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    // 5. Perceptual hash — bridge between our `image` crate and img_hash's bundled version
    // via raw RGBA bytes (layout-compatible between versions).
    let rgba_bytes = img.to_rgba8().into_raw();
    let hash_img   = img_hash::image::RgbaImage::from_raw(width, height, rgba_bytes)
        .ok_or_else(|| "failed to create hash image".to_string())?;
    let hasher     = HasherConfig::new().to_hasher();
    let hash: ImageHash = hasher.hash_image(&hash_img);
    let phash      = hash.to_base64();

    // 6. Blur detection (Laplacian variance on grayscale)
    let is_blurry = laplacian_variance(&img) < BLUR_THRESHOLD;

    Ok(ImportedPhoto {
        id,
        original:  path_to_string(&original_path),
        thumbnail: path_to_string(&thumb_path),
        medium:    path_to_string(&medium_path),
        phash,
        width,
        height,
        is_blurry,
    })
}

/// Detect image blur via Laplacian variance.
/// Lower values = blurrier.
fn laplacian_variance(img: &image::DynamicImage) -> f64 {
    let gray = img.to_luma8();
    let (w, h) = gray.dimensions();
    if w < 3 || h < 3 {
        return 0.0;
    }

    let mut sum   = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut count  = 0u64;

    // 3×3 Laplacian kernel: [[0,1,0],[1,-4,1],[0,1,0]]
    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let lap = gray.get_pixel(x, y - 1)[0] as i32
                + gray.get_pixel(x - 1, y)[0] as i32
                + gray.get_pixel(x + 1, y)[0] as i32
                + gray.get_pixel(x, y + 1)[0] as i32
                - 4 * gray.get_pixel(x, y)[0] as i32;
            let f = lap as f64;
            sum    += f;
            sum_sq += f * f;
            count  += 1;
        }
    }

    let mean = sum / count as f64;
    (sum_sq / count as f64) - mean * mean
}

fn path_to_string(p: &PathBuf) -> String {
    p.to_string_lossy().into_owned()
}
