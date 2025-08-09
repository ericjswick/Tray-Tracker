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
        this.currentContext = context;
        const video = document.getElementById(`${context}Camera`);

        try {
            this.currentStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            video.srcObject = this.currentStream;
            video.classList.remove('d-none');

            // Add capture button
            const container = video.parentElement;
            let captureBtn = container.querySelector('.capture-btn');
            if (!captureBtn) {
                captureBtn = document.createElement('button');
                captureBtn.type = 'button';
                captureBtn.className = 'btn btn-primary capture-btn';
                captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture';
                captureBtn.onclick = () => this.capturePhoto(context);
                container.appendChild(captureBtn);
            }
        } catch (error) {
            console.error('Camera access error:', error);
            alert('Camera access denied. Please use file upload instead.');
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
            this.handlePhotoCapture(context, file);
        }
    }

    async handlePhotoCapture(context, blob) {
        try {
            // Store the blob for later upload
            this.capturedPhotos.set(context, blob);

            // Show preview
            const previewDiv = document.getElementById(`${context}PhotoPreview`);
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.className = 'photo-preview';

            previewDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check"></i> Photo captured successfully!
                </div>
            `;
            previewDiv.appendChild(img);
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
            }

            // Remove capture button
            const captureBtn = video?.parentElement?.querySelector('.capture-btn');
            if (captureBtn) {
                captureBtn.remove();
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
    }
}