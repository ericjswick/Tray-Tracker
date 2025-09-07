# 🔧 Configuration System

This directory contains environment-specific Firebase configurations for the Tray Tracker application.

## 📁 Available Configurations

| Config File | Description | Firebase Project |
|-------------|-------------|------------------|
| `default.config.js` | Default/Original Configuration | `si-bone-tracking` |
| `dino-dev-1.config.js` | Dino's Development Environment | `tray-tracker-dino` |

## 🚀 How to Use

### 1. **Browser (localStorage)**
Open browser developer console and run:
```javascript
// Use Dino's development environment
localStorage.setItem('ENVIRONMENT_VARIABLE_FILE', 'dino-dev-1');

// Use default environment
localStorage.setItem('ENVIRONMENT_VARIABLE_FILE', 'default');

// Clear environment variable (uses default)
localStorage.removeItem('ENVIRONMENT_VARIABLE_FILE');

// Then refresh the page
location.reload();
```

### 2. **Browser (Window Variable)**
Add to your browser console or a script tag:
```javascript
// Set before importing config
window.ENVIRONMENT_VARIABLE_FILE = 'dino-dev-1';
```

### 3. **Docker Environment**
Update `docker-compose.yml`:
```yaml
services:
  web:
    environment:
      - ENVIRONMENT_VARIABLE_FILE=dino-dev-1
```

Or run with environment variable:
```bash
docker run -e ENVIRONMENT_VARIABLE_FILE=dino-dev-1 your-image
```

### 4. **Node.js/Server Environment**
```bash
export ENVIRONMENT_VARIABLE_FILE=dino-dev-1
npm start
```

## 🧪 Testing the Configuration

1. **Visit the test page:** `http://localhost:9090/test-config.html`
2. **Use browser controls** to switch between configurations
3. **Refresh page** to see changes take effect
4. **Check console logs** for configuration loading details

## ➕ Adding New Configurations

1. **Create a new config file:**
   ```javascript
   // config/your-env-name.config.js
   export const firebaseConfig = {
       apiKey: "your-api-key",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.firebasestorage.app",
       messagingSenderId: "your-sender-id",
       appId: "your-app-id",
       measurementId: "your-measurement-id"
   };

   export const environmentConfig = {
       name: "your-env-name",
       description: "Your Environment Description",
       isDevelopment: true,
       enableConsoleLogging: true,
       enableDebugMode: false
   };
   ```

2. **Use the new configuration:**
   ```javascript
   localStorage.setItem('ENVIRONMENT_VARIABLE_FILE', 'your-env-name');
   ```

## 🔄 Configuration Loading Priority

The system checks for the environment variable in this order:

1. `process.env.ENVIRONMENT_VARIABLE_FILE` (Node.js/Docker)
2. `window.ENVIRONMENT_VARIABLE_FILE` (Browser global)
3. `localStorage.getItem('ENVIRONMENT_VARIABLE_FILE')` (Browser storage)
4. `'default'` (fallback)

## 🛡️ Error Handling

- **Config file not found:** Falls back to `default.config.js`
- **Default config not found:** Falls back to inline configuration
- **Import errors:** Logged to console with detailed error messages
- **Invalid config format:** Application will show Firebase connection errors

## 📝 Configuration Structure

Each config file must export two objects:

```javascript
export const firebaseConfig = {
    // Standard Firebase configuration object
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
    measurementId: "..."
};

export const environmentConfig = {
    name: "environment-name",           // Required: Environment identifier
    description: "Description",        // Required: Human-readable description
    isDevelopment: boolean,            // Optional: Development flag
    enableConsoleLogging: boolean,     // Optional: Enable detailed logging
    enableDebugMode: boolean           // Optional: Enable debug features
};
```

## 🔍 Console Output

When the configuration system loads, you'll see console messages like:

```
Loading configuration: dino-dev-1
✅ Successfully loaded config: dino-dev-1
🔧 Environment Config: {name: "dino-dev-1", description: "Dino Development Environment 1", ...}
🔥 Firebase Config loaded for project: tray-tracker-dino
```

## 🚨 Security Notes

- **Never commit sensitive API keys** to public repositories
- **Use environment variables** for production deployments
- **Separate configs per environment** (dev, staging, production)
- **Validate Firebase project permissions** before deploying

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| Config not loading | Check file name matches exactly (case-sensitive) |
| Firebase errors | Verify all Firebase config values are correct |
| Console errors | Check browser developer tools for detailed error messages |
| Changes not applied | Refresh the page after setting environment variable |

## 🔄 Switching Between Environments

**Quick Switch Examples:**

```bash
# Local Development - Default
# (no environment variable needed)

# Local Development - Dino's Environment  
localStorage.setItem('ENVIRONMENT_VARIABLE_FILE', 'dino-dev-1');

# Docker - Dino's Environment
docker-compose up -d -e ENVIRONMENT_VARIABLE_FILE=dino-dev-1

# Production
export ENVIRONMENT_VARIABLE_FILE=production
```

---

**🎯 The configuration system provides flexible, environment-specific Firebase settings while maintaining backward compatibility and robust error handling.**