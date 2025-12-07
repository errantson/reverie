/**
 * Avatar Upload Widget
 * Handles avatar updates with app password authentication
 */

class UploadAvatar {
    constructor() {
        this.modal = null;
        console.log('✅ [UploadAvatar] Avatar upload widget initialized');
    }

    async initiate() {
        console.log('🖼️ [UploadAvatar] Initiate called');
        // Check if app password is connected
        const hasAppPassword = await this.checkAppPassword();
        
        if (!hasAppPassword) {
            // Show app password prompt first (customized from work.html pattern)
            this.showAppPasswordPrompt();
        } else {
            // Show avatar upload dialog
            this.showAvatarUpload();
        }
    }

    async checkAppPassword() {
        try {
            const token = localStorage.getItem('oauth_token');
            const response = await fetch('/api/user/credentials/check', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            return data.connected === true;
        } catch (error) {
            console.error('Error checking app password:', error);
            return false;
        }
    }

    showAppPasswordPrompt() {
        this.modal = document.createElement('div');
        this.modal.className = 'avatar-upload-modal';
        this.modal.innerHTML = `
            <div class="avatar-upload-content">
                <h3>App Password Required</h3>
                <p>To update your avatar on Bluesky, you need to connect an app password.</p>
                <p class="help-text">You can generate one at <a href="https://bsky.app/settings/app-passwords" target="_blank">bsky.app/settings/app-passwords</a></p>
                
                <div class="app-password-input-group">
                    <label>Enter App Password</label>
                    <input type="text" 
                           id="avatarAppPassword" 
                           class="app-password-input"
                           placeholder="xxxx-xxxx-xxxx-xxxx"
                           maxlength="19"
                           autocomplete="off"
                           autocorrect="off"
                           autocapitalize="off"
                           spellcheck="false">
                </div>
                
                <div class="avatar-upload-actions">
                    <button class="cancel-btn" onclick="window.uploadAvatar.cancel()">Cancel</button>
                    <button class="connect-btn" onclick="window.uploadAvatar.connectAndProceed()">Connect & Continue</button>
                </div>
                <div class="avatar-upload-status" id="avatarUploadStatus"></div>
            </div>
        `;
        document.body.appendChild(this.modal);

        // Setup input formatting
        const input = document.getElementById('avatarAppPassword');
        if (input) {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^a-z0-9-]/gi, '');
                let formatted = '';
                for (let i = 0; i < value.length && i < 16; i++) {
                    if (i > 0 && i % 4 === 0) formatted += '-';
                    formatted += value[i];
                }
                e.target.value = formatted;
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.connectAndProceed();
                }
            });
        }
    }

    async connectAndProceed() {
        const input = document.getElementById('avatarAppPassword');
        const statusEl = document.getElementById('avatarUploadStatus');
        const appPassword = input.value.trim();

        if (!appPassword || appPassword.length < 19) {
            statusEl.textContent = 'Please enter a valid app password';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        statusEl.textContent = 'Connecting...';
        statusEl.className = 'avatar-upload-status checking';

        try {
            const token = localStorage.getItem('oauth_token');
            const response = await fetch('/api/user/credentials/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ appPassword })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to connect app password');
            }

            statusEl.textContent = 'Connected! Opening avatar upload...';
            statusEl.className = 'avatar-upload-status success';

            setTimeout(() => {
                this.cancel();
                this.showAvatarUpload();
            }, 1000);

        } catch (error) {
            console.error('Error connecting app password:', error);
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'avatar-upload-status error';
        }
    }

    showAvatarUpload() {
        this.modal = document.createElement('div');
        this.modal.className = 'avatar-upload-modal';
        this.modal.innerHTML = `
            <div class="avatar-upload-content">
                <h3>Update Avatar</h3>
                <p>Choose a new avatar image for your Bluesky profile.</p>
                
                <div class="avatar-preview-area">
                    <img id="avatarPreview" src="/assets/icon_face.png" alt="Avatar preview">
                </div>
                
                <div class="avatar-file-input-group">
                    <input type="file" 
                           id="avatarFileInput" 
                           accept="image/png,image/jpeg,image/jpg"
                           onchange="window.uploadAvatar.previewImage(this)">
                    <label for="avatarFileInput" class="file-input-label">
                        Choose Image
                    </label>
                    <span class="file-input-hint">PNG or JPEG, max 1MB</span>
                </div>
                
                <div class="avatar-upload-actions">
                    <button class="cancel-btn" onclick="window.uploadAvatar.cancel()">Cancel</button>
                    <button class="upload-btn" onclick="window.uploadAvatar.uploadImage()">Upload Avatar</button>
                </div>
                <div class="avatar-upload-status" id="avatarUploadStatus"></div>
            </div>
        `;
        document.body.appendChild(this.modal);
    }

    previewImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('avatarPreview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    async uploadImage() {
        const fileInput = document.getElementById('avatarFileInput');
        const statusEl = document.getElementById('avatarUploadStatus');

        if (!fileInput.files || !fileInput.files[0]) {
            statusEl.textContent = 'Please select an image';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        const file = fileInput.files[0];

        // Validate file size (1MB max)
        if (file.size > 1024 * 1024) {
            statusEl.textContent = 'Image must be smaller than 1MB';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        statusEl.textContent = 'Uploading avatar...';
        statusEl.className = 'avatar-upload-status uploading';

        try {
            const token = localStorage.getItem('oauth_token');
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('/api/user/update-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update avatar');
            }

            statusEl.textContent = 'Avatar updated successfully!';
            statusEl.className = 'avatar-upload-status success';

            setTimeout(() => {
                this.cancel();
                location.reload(); // Refresh to show new avatar
            }, 1500);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'avatar-upload-status error';
        }
    }

    cancel() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

// Initialize global instance
try {
    window.uploadAvatar = new UploadAvatar();
} catch (error) {
    console.error('❌ [UploadAvatar] Failed to initialize:', error);
}
