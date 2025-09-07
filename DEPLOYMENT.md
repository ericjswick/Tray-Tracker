# Tray Tracker Deployment Guide

## Docker Container Management

### Starting the Application

To start the tray-tracker application with proper container naming:

```bash
cd /hosting/web/traytracker.com-virt/tray-tracker
docker-compose -p traytracker up -d
```

### Checking Container Status

To view running containers for the traytracker project:

```bash
cd /hosting/web/traytracker.com-virt/tray-tracker
docker-compose -p traytracker ps
```

### Restarting Individual Services

To restart just the frontend (web) container:

```bash
cd /hosting/web/traytracker.com-virt/tray-tracker
docker-compose -p traytracker restart web
```

To restart just the API server:

```bash
cd /hosting/web/traytracker.com-virt/tray-tracker
docker-compose -p traytracker restart api-server
```

### Container Information

- **Frontend Container**: `html-js-server` (nginx:alpine)
  - Port: 9090:80
  - Serves static files from the tray-tracker directory
  
- **API Container**: `tray-tracker-api` (custom Node.js build)
  - Port: 9180:3000
  - Handles API requests and database connections

### Important Notes

1. **Always use `-p traytracker`** when running docker-compose commands to ensure proper project naming and avoid container conflicts.

2. **Container Dependencies**: The web container depends on the api-server container, so starting the web service will automatically start the API if needed.

3. **Environment Variables**: Firebase credentials (FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY) should be set in the server/.env file.

4. **Port Access**: 
   - Frontend: http://localhost:9090 or https://traytracker-dev.serverdatahost.com
   - API: http://localhost:9180

### Troubleshooting Container Issues

If you encounter container name conflicts:

1. Check existing containers: `docker ps -a`
2. Remove conflicting containers: `docker rm <container-name>`
3. Restart with proper project naming: `docker-compose -p traytracker up -d`

### Development vs Production

This configuration is set up for development. For production deployment, ensure:
- Proper environment variables are configured
- Rate limiting is enabled (currently commented out for debugging)
- Security headers and HTTPS are properly configured