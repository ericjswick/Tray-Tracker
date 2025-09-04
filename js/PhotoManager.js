// js/PhotoManager.js
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js";

export class PhotoManager {
    constructor(storage) {
        this.storage = storage;
        this.currentStream = null;
        this.currentContext = null;
        this.capturedPhotos = new Map();
    }

    async startCamera(context) {
        // On mobile, we'll skip the video preview and go straight to file input
        // This provides a better user experience on mobile devices
        if (this.isMobileDevice()) {
            this.showMobilePhotoOptions(context);
            return;
        }

        // Desktop camera functionality
        this.currentContext = context;
        const video = document.getElementById(`${context}Camera`);

        try {
            // Request back camera on mobile, any camera on desktop
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: this.isMobileDevice() ? 'environment' : 'user'
                }
            };

            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.currentStream;
            video.classList.remove('d-none');

            // Add capture button
            const container = video.parentElement;
            let captureBtn = container.querySelector('.capture-btn');
            if (!captureBtn) {
                captureBtn = document.createElement('button');
                captureBtn.type = 'button';
                captureBtn.className = 'btn btn-primary capture-btn mt-2';
                captureBtn.innerHTML = '<i class="fas fa-camera"></i> Take Photo';
                captureBtn.onclick = () => this.capturePhoto(context);
                container.appendChild(captureBtn);
            }

            // Add switch camera button on mobile
            if (this.isMobileDevice()) {
                let switchBtn = container.querySelector('.switch-camera-btn');
                if (!switchBtn) {
                    switchBtn = document.createElement('button');
                    switchBtn.type = 'button';
                    switchBtn.className = 'btn btn-secondary switch-camera-btn mt-2 ms-2';
                    switchBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Switch';
                    switchBtn.onclick = () => this.switchCamera(context);
                    container.appendChild(switchBtn);
                }
            }
        } catch (error) {
            console.error('Camera access error:', error);
            // Fallback to file input
            this.showMobilePhotoOptions(context);
        }
    }

    showMobilePhotoOptions(context) {
        const container = document.getElementById(`${context}Camera`)?.parentElement;
        if (!container) return;

        // Create mobile-friendly photo options
        const mobileOptions = document.createElement('div');
        mobileOptions.className = 'mobile-photo-options';
        mobileOptions.innerHTML = `
            <div class="photo-option-buttons">
                <input type="file" id="${context}CameraInput" accept="image/*" capture="environment" class="d-none" onchange="app.photoManager.handleFileSelect('${context}', this)">
                <input type="file" id="${context}GalleryInput" accept="image/*" class="d-none" onchange="app.photoManager.handleFileSelect('${context}', this)">
                
                <button type="button" class="btn btn-primary w-100 mb-2" onclick="document.getElementById('${context}CameraInput').click()">
                    <i class="fas fa-camera"></i> Take Photo
                </button>
                
                <button type="button" class="btn btn-secondary w-100" onclick="document.getElementById('${context}GalleryInput').click()">
                    <i class="fas fa-images"></i> Choose from Gallery
                </button>
            </div>
        `;

        // Replace existing content
        container.innerHTML = '';
        container.appendChild(mobileOptions);
    }

    async switchCamera(context) {
        if (!this.currentStream) return;

        try {
            // Get current facing mode
            const videoTrack = this.currentStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            const currentFacingMode = settings.facingMode;

            // Stop current stream
            this.stopCamera();

            // Start with opposite facing mode
            const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: newFacingMode
                }
            };

            const video = document.getElementById(`${context}Camera`);
            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.currentStream;
        } catch (error) {
            console.error('Error switching camera:', error);
            // If switching fails, try again with the original camera
            this.startCamera(context);
        }
    }

    capturePhoto(context) {
        const video = document.getElementById(`${context}Camera`);
        const canvas = document.getElementById(`${context}Canvas`);

        if (!canvas) {
            console.error('Canvas element not found for context:', context);
            return;
        }

        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Convert to blob
        canvas.toBlob((blob) => {
            this.handlePhotoCapture(context, blob);
        }, 'image/jpeg', 0.8);

        this.stopCamera();
    }

    handleFileSelect(context, input) {
        const file = input.files[0];
        if (file && file.type.startsWith('image/')) {
            // Compress image if it's too large
            this.compressImage(file, (compressedBlob) => {
                this.handlePhotoCapture(context, compressedBlob);
            });
        }
    }

    compressImage(file, callback) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            // Calculate new dimensions (max 1280px width)
            const maxWidth = 1280;
            const maxHeight = 1280;
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(callback, 'image/jpeg', 0.8);
        };

        img.src = URL.createObjectURL(file);
    }

    async handlePhotoCapture(context, blob) {
        try {
            // Store the blob for later upload
            this.capturedPhotos.set(context, blob);

            // Show preview
            const previewDiv = document.getElementById(`${context}PhotoPreview`);
            if (previewDiv) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(blob);
                img.className = 'photo-preview';
                img.style.cssText = `
                    max-width: 150px;
                    max-height: 150px;
                    object-fit: cover;
                    border-radius: 0.375rem;
                    border: 1px solid var(--gray-200);
                    margin-top: 0.5rem;
                `;

                previewDiv.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check"></i> Photo captured successfully!
                        <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="app.photoManager.clearPhoto('${context}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                `;
                previewDiv.appendChild(img);
            }
        } catch (error) {
            console.error('Photo capture error:', error);
            alert('Error capturing photo: ' + error.message);
        }
    }

    async uploadPhoto(context, folder = 'tray-photos') {
        const blob = this.capturedPhotos.get(context);
        if (!blob || !this.storage) return null;

        try {
            const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const storageRef = ref(this.storage, fileName);

            const snapshot = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Clean up the blob
            this.capturedPhotos.delete(context);

            return downloadURL;
        } catch (error) {
            console.error('Photo upload error:', error);
            throw error;
        }
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        if (this.currentContext) {
            const video = document.getElementById(`${this.currentContext}Camera`);
            if (video) {
                video.classList.add('d-none');
                video.srcObject = null;
            }

            // Remove camera control buttons
            const container = video?.parentElement;
            if (container) {
                const captureBtn = container.querySelector('.capture-btn');
                const switchBtn = container.querySelector('.switch-camera-btn');
                if (captureBtn) captureBtn.remove();
                if (switchBtn) switchBtn.remove();
            }
        }
    }

    hasPhoto(context) {
        return this.capturedPhotos.has(context);
    }

    clearPhoto(context) {
        this.capturedPhotos.delete(context);
        const previewDiv = document.getElementById(`${context}PhotoPreview`);
        if (previewDiv) {
            previewDiv.innerHTML = '';
        }

        // Reset photo inputs
        const cameraInput = document.getElementById(`${context}CameraInput`);
        const galleryInput = document.getElementById(`${context}GalleryInput`);
        if (cameraInput) cameraInput.value = '';
        if (galleryInput) galleryInput.value = '';
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }
}