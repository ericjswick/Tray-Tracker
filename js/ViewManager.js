// js/ViewManager.js
export class ViewManager {
    showView(viewName) {
        console.log('Switching to view:', viewName);

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('d-none');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.remove('d-none');
            console.log('View shown:', viewName);
        } else {
            console.error('View not found:', `${viewName}View`);
        }

        // Initialize specific view logic
        if (viewName === 'map') {
            setTimeout(() => {
                if (window.app.mapManager) {
                    window.app.mapManager.initializeMap();
                    if (window.app.trayManager.currentTrays) {
                        window.app.mapManager.updateMap(window.app.trayManager.currentTrays);
                    }
                }
            }, 100);
        } else if (viewName === 'team') {
            this.renderTeamView();
        } else if (viewName === 'users') {
            console.log('Initializing users view');
            if (window.app.userManager) {
                setTimeout(() => {
                    try {
                        window.app.userManager.initializeViewMode();
                        // Force render users if data is available
                        if (window.app.dataManager.users && window.app.dataManager.users.size > 0) {
                            window.app.userManager.handleUsersUpdate(window.app.dataManager.users);
                        } else {
                            // If no users data yet, show loading and wait for data
                            window.app.userManager.showLoadingState();
                        }
                        console.log('Users view initialized');
                    } catch (error) {
                        console.error('Error initializing users view:', error);
                    }
                }, 100);
            } else {
                console.error('UserManager not found');
            }
        } else if (viewName === 'locations') {
            console.log('Initializing locations view');
            if (window.app.locationManager) {
                setTimeout(() => {
                    try {
                        window.app.locationManager.initializeViewMode();
                        // Force render if data is available, otherwise the real-time listener will handle it
                        console.log('Locations view initialized');
                    } catch (error) {
                        console.error('Error initializing locations view:', error);
                    }
                }, 100);
            } else {
                console.error('LocationManager not found');
            }
        }
    }

    renderTeamView() {
        const teamList = document.getElementById('teamList');
        const users = window.app.dataManager.getUsers();

        if (users.size === 0) {
            teamList.innerHTML = '<p class="text-muted">Loading team members...</p>';
            return;
        }

        teamList.innerHTML = '';
        users.forEach((user) => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            memberDiv.innerHTML = `
                <div class="flex-grow-1">
                    <h6 class="mb-1">${user.name}</h6>
                    <p class="mb-1 text-muted">${user.role}</p>
                    <small class="text-muted">
                        <i class="fas fa-envelope"></i> ${user.email}
                        ${user.phone ? ` | <i class="fas fa-phone"></i> ${user.phone}` : ''}
                    </small>
                </div>
            `;
            teamList.appendChild(memberDiv);
        });

        // Populate notification recipients
        const recipientsDiv = document.getElementById('notificationRecipients');
        recipientsDiv.innerHTML = '';
        users.forEach((user, id) => {
            const checkDiv = document.createElement('div');
            checkDiv.className = 'form-check';
            checkDiv.innerHTML = `
                <input class="form-check-input" type="checkbox" id="notify-${id}" value="${id}">
                <label class="form-check-label" for="notify-${id}">
                    ${user.name}
                </label>
            `;
            recipientsDiv.appendChild(checkDiv);
        });
    }

    handleUsersUpdate(users) {
        // Re-render team view if it's currently visible
        const teamView = document.getElementById('teamView');
        if (!teamView.classList.contains('d-none')) {
            this.renderTeamView();
        }
    }
}