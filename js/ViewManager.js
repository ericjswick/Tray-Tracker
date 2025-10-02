// js/ViewManager.js - Updated for Tray Tracker
import { routingDetector } from './utils/RoutingDetector.js';
import { isInUseStatus, isAvailableStatus, isCheckedInStatus, normalizeStatus, TRAY_STATUS, populateTrayStatusDropdown, getStatusDisplayText } from './constants/TrayStatus.js';
import { populateFacilityTypeDropdown } from './constants/FacilityTypes.js';
import { TRAY_LOCATIONS } from './constants/TrayLocations.js';
import { USER_ROLES } from './constants/UserRoles.js';

export class ViewManager {
    constructor() {
        this.currentView = 'dashboard';
        this.routingStrategy = 'hash'; // Default to hash, will be detected
        this.isInitialLoad = true;
    }

    showView(viewName, updateUrl = true) {

        // Update URL if requested (avoid infinite loops during initial load)
        if (updateUrl) {
            this.updateUrl(viewName);
        }

        // Update navigation active state
        this.updateNavigationState(viewName);

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('d-none');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.remove('d-none');
            this.currentView = viewName;
        } else {
            console.error('View not found:', `${viewName}View`);
        }

        // Initialize specific view logic
        this.initializeViewLogic(viewName);
    }

    updateUrl(viewName) {
        // Update browser URL without triggering page reload
        let newUrl;
        
        if (this.routingStrategy === 'clean') {
            // Clean URLs: /locations, /trays, etc.
            newUrl = viewName === 'dashboard' ? '/' : `/${viewName}`;
        } else {
            // Hash URLs: /#locations, /#trays, etc.
            newUrl = viewName === 'dashboard' ? '/' : `/#${viewName}`;
        }
        
        window.history.pushState({ view: viewName }, '', newUrl);
    }

    updateNavigationState(activeView) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current nav item
        const activeNavItem = document.getElementById(`nav-${activeView}`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    initializeViewLogic(viewName) {
        switch (viewName) {
            case 'dashboard':
                this.initializeDashboard();
                break;
            case 'team':
                this.initializeTeamView();
                break;
            case 'map':
                this.initializeFacilitiesView();
                break;
            case 'trays':
                this.initializeTraysView();
                break;
            case 'users':
                this.initializeUsersView();
                break;
            case 'facilityAdmin':
                this.initializeFacilityAdminView();
                break;
            case 'surgeons':
                this.initializeSurgeonsView();
                break;
            case 'physicians':
                this.initializePhysiciansView();
                break;
            case 'map':
                this.initializeMapView();
                break;
            case 'casetypes':
                this.initializeCaseTypesView();
                break;
            case 'implanttypes':
                this.initializeImplantTypesView();
                break;
            case 'cases':
                this.initializeCasesView();
                break;
            case 'migrations':
                this.initializeMigrationsView();
                break;
            case 'admin_data_migrations':
                this.initializeAdminDataMigrationsView();
                break;
        }
    }

    initializeCaseTypesView() {
        console.log('Initializing case types view');
        setTimeout(() => {
            if (window.app.caseTypeManager) {
                try {
                    window.app.caseTypeManager.initializeViewMode();
                    console.log('Case types view initialized');
                } catch (error) {
                    console.error('Error initializing case types view:', error);
                }
            } else {
                console.error('CaseTypeManager not found');
            }
        }, 100);
    }

    initializeImplantTypesView() {
        console.log('Initializing implant types view');
        setTimeout(() => {
            if (window.app.implantTypeManager) {
                try {
                    window.app.implantTypeManager.initializeViewMode();
                    window.app.implantTypeManager.loadImplantTypes();
                    console.log('Implant types view initialized');
                } catch (error) {
                    console.error('Error initializing implant types view:', error);
                }
            } else {
                console.error('ImplantTypeManager not found');
            }
        }, 100);
    }

    initializeCasesView() {
        console.log('Initializing cases view');
        setTimeout(async () => {
            if (window.app.casesManager) {
                try {
                    // Ensure surgeon data is available for case modal dropdowns
                    if (window.app.dataManager) {
                        console.log('🔄 Ensuring surgeon data is available for cases view...');
                        await window.app.dataManager.ensureSurgeonsLoaded();
                    }

                    window.app.casesManager.initializeViewMode();
                    window.app.casesManager.loadCases();
                    console.log('Cases view initialized');
                } catch (error) {
                    console.error('Error initializing cases view:', error);
                }
            } else {
                console.error('CasesManager not found');
            }
        }, 100);
    }

    initializeMigrationsView() {
        console.log('Initializing migrations view');
        if (window.app.migrationsManager) {
            // Load migration status on view initialization
            window.app.migrationsManager.checkMigrationStatus();
        } else {
            console.error('MigrationsManager not found');
        }
    }

    initializeDashboard() {
        // Dashboard shows a subset of trays in the main content area
        // The existing tray manager will handle rendering
        setTimeout(() => {
            if (window.app.trayManager) {
                window.app.trayManager.initializeViewMode();
                // Render trays in dashboard container
                if (window.app.trayManager.currentTrays) {
                    this.renderDashboardTrays(window.app.trayManager.currentTrays);
                }
            }
            
            // Initialize dashboard cases
            if (window.app.dashboardManager) {
                window.app.dashboardManager.initialize();
            }
            
            // Backfill tray history if needed (only runs once)
            this.backfillTrayHistoryIfNeeded();
            
            // Load recent activity
            this.loadRecentActivity();
            
            // Set up dashboard filter listeners
            const dashboardFilter = document.getElementById('dashboardStatusFilter');
            if (dashboardFilter) {
                dashboardFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        this.renderDashboardTrays(window.app.trayManager.currentTrays);
                    }
                });
            }
            
            const dashboardUserFilter = document.getElementById('dashboardUserFilter');
            if (dashboardUserFilter) {
                dashboardUserFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        this.renderDashboardTrays(window.app.trayManager.currentTrays);
                    }
                });
            }
            
            // Populate dashboard user filter
            this.populateDashboardUserFilter();
        }, 100);
    }

    initializeTeamView() {
        setTimeout(() => {
            if (window.app.dataManager && window.app.dataManager.getUsers) {
                const users = window.app.dataManager.getUsers();
                this.renderTeamMembers(users);
            }
        }, 100);
    }

    initializeFacilitiesView() {
        setTimeout(() => {
            // Populate facility type filter dropdown
            const locationTypeFilter = document.getElementById('locationTypeFilter');
            if (locationTypeFilter) {
                populateFacilityTypeDropdown(locationTypeFilter, {
                    includeAllOption: true,
                    allOptionText: 'All Facility Types',
                    includeEmptyOption: false,
                    useShortLabels: true
                });
            }
            
            // Populate tray status filter dropdown
            const trayStatusFilter = document.getElementById('trayStatusFilter');
            if (trayStatusFilter) {
                populateTrayStatusDropdown(trayStatusFilter, {
                    includeAllOption: true,
                    allOptionText: 'All Tray Status',
                    includeEmptyOption: false
                });
            }
            
            // Initialize facility manager to load facilities
            if (window.app.facilityManager) {
                console.log('🏗️ Initializing facility manager for map view...');
                window.app.facilityManager.initializeViewMode();
            }
            
            if (window.app.mapManager) {
                window.app.mapManager.initializeMap();
                
                // Set up combined filters for both facilities and trays
                window.app.mapManager.setupLocationFilters();
                
                // Show both facility and tray markers with combined filters
                window.app.mapManager.updateCombinedFilters();
            }
        }, 100);
    }

    initializeTraysView() {
        setTimeout(() => {
            if (window.app.trayManager) {
                window.app.trayManager.initializeViewMode();
                if (window.app.trayManager.currentTrays) {
                    window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
                }
            }

            // Set up trays page filter listeners
            const traysFilter = document.getElementById('traysStatusFilter');
            if (traysFilter) {
                traysFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
                    }
                });
            }

            const traysUserFilter = document.getElementById('traysUserFilter');
            if (traysUserFilter) {
                traysUserFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
                    }
                });
            }

            // Populate trays user filter (unless viewAllTrays flag is set)
            if (!window._trayViewShowingAllTrays) {
                this.populateTraysUserFilter();
            } else {
                console.log('⏭️ Skipping populateTraysUserFilter due to _trayViewShowingAllTrays flag');
            }
        }, 100);
    }

    initializeUsersView() {
        console.log('Initializing users view');
        setTimeout(() => {
            if (window.app.userManager) {
                try {
                    window.app.userManager.initializeViewMode();

                    // Force check for users data after a delay
                    setTimeout(() => {
                        if (window.app.dataManager.users && window.app.dataManager.users.size > 0) {
                            console.log('Force updating users in view:', window.app.dataManager.users.size);
                            window.app.userManager.handleUsersUpdate(window.app.dataManager.users);
                        } else {
                            console.log('No users data available in DataManager');
                        }
                    }, 1000);

                    console.log('Users view initialized');
                } catch (error) {
                    console.error('Error initializing users view:', error);
                }
            } else {
                console.error('UserManager not found');
            }
        }, 100);
    }

    initializeFacilityAdminView() {
        console.log('Initializing facility admin view');
        setTimeout(() => {
            if (window.app.facilityManager) {
                try {
                    window.app.facilityManager.initializeViewMode();
                    console.log('Facility admin view initialized');
                } catch (error) {
                    console.error('Error initializing facility admin view:', error);
                }
            } else {
                console.error('FacilityManager not found');
            }
        }, 100);
    }

    initializeSurgeonsView() {
        console.log('Initializing surgeons view');
        setTimeout(() => {
            if (window.app.surgeonManager) {
                try {
                    window.app.surgeonManager.initializeViewMode();
                    console.log('Surgeons view initialized');
                } catch (error) {
                    console.error('Error initializing surgeons view:', error);
                }
            } else {
                console.error('SurgeonManager not found');
            }
        }, 100);
    }

    initializePhysiciansView() {
        console.log('Initializing physicians view');
        setTimeout(() => {
            if (window.app.surgeonManager) {
                try {
                    window.app.surgeonManager.initializeViewMode();
                    console.log('Physicians view initialized using SurgeonManager');
                } catch (error) {
                    console.error('Error initializing physicians view:', error);
                }
            } else {
                console.error('SurgeonManager not found');
            }
        }, 100);
    }

    initializeMapView() {
        // Use longer timeout to ensure container is properly sized
        setTimeout(() => {
            if (window.app.mapManager) {
                // Ensure map container is visible and properly sized
                const mapContainer = document.getElementById('map');
                if (mapContainer) {
                    // Force reflow to ensure container dimensions are calculated
                    mapContainer.style.display = 'block';
                    mapContainer.offsetHeight; // Force reflow
                    
                    console.log('🗺️ Initializing map view with container size:', {
                        width: mapContainer.offsetWidth,
                        height: mapContainer.offsetHeight,
                        visible: mapContainer.offsetParent !== null
                    });
                }
                
                window.app.mapManager.initializeMap();
                
                // Additional timeout to ensure map is fully initialized before adding markers
                setTimeout(() => {
                    if (window.app.mapManager.map) {
                        // Force map to invalidate size in case container wasn't properly sized initially
                        window.app.mapManager.map.invalidateSize();
                        
                        if (window.app.trayManager.currentTrays) {
                            window.app.mapManager.updateMap(window.app.trayManager.currentTrays);
                        }
                    }
                }, 100);
            }
        }, 250); // Increased timeout to ensure proper container sizing
    }

    renderDashboardTrays(trays) {

        const container = document.getElementById('dashboardTraysContent');
        if (!container) {
            console.warn('❌ dashboardTraysContent container not found');
            return;
        }

        console.log('✅ Container found, current innerHTML:', container.innerHTML.includes('Loading trays') ? 'Shows loading spinner' : 'Shows content');

        // Apply dashboard filters
        const statusFilter = document.getElementById('dashboardStatusFilter')?.value || '';
        const userFilter = document.getElementById('dashboardUserFilter')?.value || '';
        
        let filteredTrays = trays;
        
        if (statusFilter) {
            filteredTrays = filteredTrays.filter(tray => tray.status === statusFilter);
        }
        
        if (userFilter) {
            filteredTrays = filteredTrays.filter(tray => 
                tray.assignedTo === userFilter || tray.assignedToUID === userFilter
            );
        }

        // Sort trays by name
        filteredTrays.sort((a, b) => {
            const nameA = a.tray_name || '';
            const nameB = b.tray_name || '';
            return nameA.localeCompare(nameB);
        });

        if (filteredTrays.length === 0) {
            const message = statusFilter ?
                `No trays found with status: ${statusFilter}` :
                'No trays found';
            container.innerHTML = `
                <div class="loading-state clickable-no-trays" style="cursor: pointer;" onclick="window.app.viewManager.viewAllTrays()">
                    <i class="fas fa-eye fa-3x mb-3" style="color: var(--primary-color);"></i>
                    <p>${message}. <strong>Click here to View All Trays.</strong></p>
                </div>
            `;
            return;
        }

        // Show recent filtered trays (limit to 6 for dashboard)
        const recentTrays = filteredTrays.slice(0, 6);
        container.innerHTML = '';

        recentTrays.forEach(tray => {
            const trayCard = this.createDashboardTrayCard(tray);
            container.appendChild(trayCard);
        });

        // Add "View All" card if there are more trays
        if (trays.length > 6) {
            const viewAllCard = this.createViewAllCard(trays.length - 6);
            container.appendChild(viewAllCard);
        }
    }

    createDashboardTrayCard(tray) {
        const card = document.createElement('div');
        card.className = 'tray-card';

        const statusClass = this.getStatusClass(tray.status);
        const typeIcon = this.getTrayTypeIcon(tray);
        const locationText = this.getLocationText(tray.location, tray);

        card.innerHTML = `
            <div class="tray-card-header">
                <div class="tray-card-title">
                    <div class="tray-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${tray.tray_name}
                </div>
                <span class="tray-status-badge ${statusClass}">${getStatusDisplayText(tray.status)}</span>
            </div>
            <div class="tray-card-content">
                ${this.getTrayTypeText(tray) ? `
                    <div class="tray-detail">
                        <i class="fas fa-layer-group"></i>
                        <span class="tray-detail-value">${this.getTrayTypeText(tray)}</span>
                    </div>
                ` : ''}
                <div class="tray-detail">
                    ${this.isCheckedIn(tray) ? `
                        <i class="fas fa-hospital"></i>
                        <span class="tray-detail-value">
                            <a href="#" onclick="app.trayManager.showLocationMap('${tray.id}', '${this.getTrayFacility(tray)}'); return false;" class="location-link" title="View location on map">
                                ${(() => {
                                    const facilityId = this.getTrayFacility(tray);
                                    const facilityName = this.getFacilityName(facilityId);
                                    return facilityName;
                                })()}
                            </a>
                        </span>
                    ` : `
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="tray-detail-value">
                            <a href="#" onclick="app.trayManager.showLocationMap('${tray.id}', '${tray.location}'); return false;" class="location-link" title="View location on map">
                                ${locationText}
                            </a>
                        </span>
                    `}
                </div>
                ${tray.caseDate ? `
                    <div class="tray-detail">
                        <i class="fas fa-calendar"></i>
                        <span class="tray-detail-value">${tray.caseDate}</span>
                    </div>
                ` : ''}
                ${tray.assignedTo ? `
                    <div class="tray-detail">
                        <i class="fas fa-user"></i>
                        <span class="tray-detail-value">Assigned: ${this.getUserName(tray.assignedTo)}</span>
                    </div>
                ` : ''}
                ${tray.custody_id ? `
                    <div class="tray-detail">
                        <i class="fas fa-hand-holding"></i>
                        <span class="tray-detail-value">Custody: ${this.getUserName(tray.custody_id)}</span>
                    </div>
                ` : ''}
                ${tray.surgeon ? `
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-value">${this.getSurgeonName(tray.surgeon)}</span>
                    </div>
                ` : ''}
                ${this.getCaseTypeCompatibilityText(tray) ? `
                    <div class="tray-detail">
                        <i class="fas fa-tags"></i>
                        <span class="tray-detail-value">${this.getCaseTypeCompatibilityText(tray)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="tray-card-actions">
                ${this.getTrayActions(tray)}
            </div>
        `;

        return card;
    }

    createViewAllCard(remainingCount) {
        const card = document.createElement('div');
        card.className = 'tray-card';
        card.style.cursor = 'pointer';
        card.onclick = () => this.showView('trays');

        card.innerHTML = `
            <div class="tray-card-content" style="text-align: center; padding: 2rem 1rem;">
                <i class="fas fa-plus-circle fa-3x mb-3" style="color: var(--primary-blue);"></i>
                <h5 style="color: var(--primary-blue); margin-bottom: 0.5rem;">View All Trays</h5>
                <p class="text-muted">See ${remainingCount} more trays</p>
            </div>
        `;

        return card;
    }

    populateDashboardUserFilter() {
        const dashboardUserFilter = document.getElementById('dashboardUserFilter');
        if (!dashboardUserFilter) return;

        // Clear existing options except "All Users"
        dashboardUserFilter.innerHTML = '<option value="">All Users</option>';

        // Get users from DataManager
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const users = Array.from(window.app.dataManager.users.values())
                .filter(user => user.active !== false) // Only show active users
                .sort((a, b) => {
                    const nameA = a.name || a.email || '';
                    const nameB = b.name || b.email || '';
                    return nameA.localeCompare(nameB);
                });

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.uid || user.id; // Use uid first, fallback to id
                option.textContent = user.name || user.email || 'Unknown User';
                dashboardUserFilter.appendChild(option);
            });

            // Set default based on user role
            const currentUser = window.app?.authManager?.currentUser;
            if (currentUser) {
                // If admin, default to "All Users", otherwise default to current user
                const isAdmin = currentUser.role === USER_ROLES.ADMIN;
                dashboardUserFilter.value = isAdmin ? '' : currentUser.uid;

                // Trigger filter update
                if (window.app.trayManager && window.app.trayManager.currentTrays) {
                    this.renderDashboardTrays(window.app.trayManager.currentTrays);
                }
            }
        }
    }

    populateTraysUserFilter(retryCount = 0, setToAllUsers = false) {
        const traysUserFilter = document.getElementById('traysUserFilter');
        if (!traysUserFilter) return;

        // Clear existing options except "All Users"
        traysUserFilter.innerHTML = '<option value="">All Users</option>';

        // Get users from DataManager
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const users = Array.from(window.app.dataManager.users.values())
                .filter(user => user.active !== false) // Only show active users
                .sort((a, b) => {
                    const nameA = a.name || a.email || '';
                    const nameB = b.name || b.email || '';
                    return nameA.localeCompare(nameB);
                });

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.uid || user.id; // Use uid first, fallback to id
                option.textContent = user.name || user.email || 'Unknown User';
                traysUserFilter.appendChild(option);
            });

            // Set default based on user role and setToAllUsers flag
            const currentUser = window.app?.authManager?.currentUser;
            if (setToAllUsers) {
                traysUserFilter.value = ''; // Set to "All Users"
            } else if (currentUser) {
                // If admin, default to "All Users", otherwise default to current user
                const isAdmin = currentUser.role === USER_ROLES.ADMIN;
                traysUserFilter.value = isAdmin ? '' : currentUser.uid;
            }


            // Trigger filter update
            if (window.app.trayManager && window.app.trayManager.currentTrays) {
                window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
            }
        } else if (retryCount < 5) {
            // Data not loaded yet, retry after delay (max 5 retries)
            setTimeout(() => {
                this.populateTraysUserFilter(retryCount + 1, setToAllUsers);
            }, 1000);
        }
    }

    renderTeamMembers(users) {
        const container = document.getElementById('teamMembersGrid');
        if (!container) return;

        if (users.size === 0) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-users fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>No team members found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        users.forEach((user) => {
            const memberCard = this.createTeamMemberCard(user);
            container.appendChild(memberCard);
        });
    }

    createTeamMemberCard(user) {
        const card = document.createElement('div');
        card.className = 'team-card';

        const initials = this.getInitials(user.name);
        const roleClass = this.getRoleClass(user.role);

        card.innerHTML = `
            <div class="team-card-header">
                <div class="team-avatar">${initials}</div>
                <div class="team-info">
                    <h4>${user.name}</h4>
                    <span class="team-role ${roleClass}">${user.role}</span>
                </div>
            </div>
            
            <div class="team-contact">
                <div class="team-contact-item">
                    <i class="fas fa-phone"></i>
                    <span>${user.phone || 'Not provided'}</span>
                </div>
                <div class="team-contact-item">
                    <i class="fas fa-envelope"></i>
                    <span>${user.email}</span>
                </div>
                <div class="team-contact-item">
                    <i class="fab fa-linkedin"></i>
                    <span>LinkedIn</span>
                </div>
                <div class="team-contact-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${user.region || 'Not specified'}</span>
                </div>
            </div>

            <div class="team-physicians">
                <h6>Treating Physicians:</h6>
                <span class="physician-badge lead">Dr. Johnson (Lead Rep)</span>
                <span class="physician-badge coverage">Dr. Smith (Coverage)</span>
            </div>

            <div class="team-notifications">
                <div class="notification-methods">
                    <span class="notification-badge active">
                        <i class="fas fa-envelope"></i>
                        Email
                    </span>
                    <span class="notification-badge active">
                        <i class="fas fa-sms"></i>
                        Text
                    </span>
                </div>
                <small class="text-muted">Physicians: Dr. Johnson, Dr. Smith</small>
            </div>
        `;

        return card;
    }

    createUserCard(user) {
        const card = document.createElement('div');
        card.className = 'user-card';

        const initials = this.getInitials(user.name);
        const roleClass = this.getRoleClass(user.role);
        const statusClass = user.active !== false ? 'text-success' : 'text-muted';
        const statusText = user.active !== false ? 'Active' : 'Inactive';

        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <h5 class="user-name">${user.name || user.email || 'Unknown User'}</h5>
                    <span class="user-role ${roleClass}">${user.role || 'No Role'}</span>
                    <div class="user-status ${statusClass}">
                        <i class="fas fa-circle"></i>
                        <span>${statusText}</span>
                    </div>
                </div>
            </div>
            
            <div class="user-details">
                <div class="user-detail">
                    <i class="fas fa-envelope"></i>
                    <span>${user.email || 'Not provided'}</span>
                </div>
                ${user.phone ? `
                    <div class="user-detail">
                        <i class="fas fa-phone"></i>
                        <span>${user.phone}</span>
                    </div>
                ` : `
                    <div class="user-detail">
                        <i class="fas fa-phone"></i>
                        <span class="empty-value">Not provided</span>
                    </div>
                `}
                ${user.region ? `
                    <div class="user-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${user.region}</span>
                    </div>
                ` : `
                    <div class="user-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="empty-value">Not assigned</span>
                    </div>
                `}
            </div>

            <div class="user-actions">
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showEditUserModal('${user.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger-custom btn-sm" onclick="app.userManager.deleteUser('${user.id}', '${user.name || user.email}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    }

    // Utility methods
    getStatusClass(status) {
        switch (status) {
            case 'available': return 'status-available';
            case 'in-use':
            case 'in_use': return 'status-in-use';
            case 'corporate':
            case 'cleaning': return 'status-cleaning';
            case 'trunk':
            case 'maintenance': return 'status-maintenance';
            default: return 'status-available';
        }
    }

    getTrayTypeIcon(tray) {
        // Support both legacy type field and MyRepData case type compatibility
        let primaryType = '';
        
        if (tray.case_type_compatibility && Array.isArray(tray.case_type_compatibility) && tray.case_type_compatibility.length > 0) {
            // Map MyRepData case types to icons
            const caseType = tray.case_type_compatibility[0]; // Use first case type for icon
            const caseTypeIcons = {
                'SI fusion': 'fas fa-link',
                'Spine fusion': 'fas fa-link',
                'Minimally Invasive': 'fas fa-microscope',
                'Revision Surgery': 'fas fa-tools',
                'Complete System': 'fas fa-briefcase-medical'
            };
            return caseTypeIcons[caseType] || 'fas fa-medical-bag';
        }
        
        // Fallback to legacy type icons
        const icons = {
            'fusion': 'fas fa-link',
            'revision': 'fas fa-tools',
            'mi': 'fas fa-microscope',
            'complete': 'fas fa-briefcase-medical'
        };
        return icons[tray.type] || 'fas fa-medical-bag';
    }

    getLocationText(locationId, tray = null) {
        // Delegate to TrayManager's enhanced location text method if available
        if (window.app?.trayManager?.getLocationText) {
            return window.app.trayManager.getLocationText(locationId, tray);
        }

        // Fallback implementation (same as TrayManager logic)
        // Special handling for Rep Trunk - show user's facility if tray is assigned
        if (locationId === 'trunk' || locationId === 'Rep Trunk' || locationId === 'rep_trunk') {
            if (tray && tray.assignedTo) {
                const userFacilityName = this.getUserFacilityName(tray.assignedTo);
                if (userFacilityName) {
                    return `Rep Trunk: ${userFacilityName}`;
                }
            }
            // Fallback to generic Rep Trunk if no assigned user or facility found
            return 'Rep Trunk';
        }

        // Get location from Firebase collection using the ID
        if (window.app.locationManager && window.app.locationManager.currentLocations) {
            const location = window.app.locationManager.currentLocations.find(
                loc => loc.id === locationId
            );
            if (location) {
                return location.name || 'Unknown';
            }
        }

        // Fallback for old static locations
        const staticLocations = {
            'trunk': 'Rep Trunk',
            'facility': 'Medical Facility',
            'corporate': 'SI-BONE Corporate',
            'cleaning': 'Cleaning Facility',
            'maintenance': 'Maintenance'
        };

        return staticLocations[locationId] || locationId || 'Unknown Location';
    }

    getUserName(userId) {
        // Check if users are loaded
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const user = window.app.dataManager.users.get(userId);
            if (user) {
                return user.name || user.email || 'Unknown User';
            }
            // User ID not found in the map
            return `User ${userId}`;
        }

        // Users not loaded yet
        return 'Loading user...';
    }

    /**
     * Get the facility name for a user's location_facility_id
     */
    getUserFacilityName(userId) {
        if (!userId) return null;

        // Get user data
        if (window.app?.dataManager?.users && window.app.dataManager.users.size > 0) {
            const user = window.app.dataManager.users.get(userId);
            if (user && user.location_facility_id) {
                // Look up the facility name using the facility ID
                const facilityName = this.getFacilityNameById(user.location_facility_id);
                return facilityName;
            }
        }

        return null;
    }

    /**
     * Get facility name by ID for location display (no fallback messages)
     */
    getFacilityNameById(facilityId) {
        if (!facilityId) {
            return null;
        }
        
        // Try facilityManager first
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.account_name || facility.name;
            }
        }
        
        // Fallback to dataManager
        if (window.app.dataManager) {
            const facilities = window.app.dataManager.getFacilities();
            if (facilities && facilities.length > 0) {
                const facility = facilities.find(f => f.id === facilityId);
                if (facility) {
                    return facility.account_name || facility.name;
                }
            }
        }
        
        return null;
    }

    getSurgeonName(surgeonId) {
        // If it's already a name (legacy data), return as is
        if (!surgeonId || typeof surgeonId !== 'string') return 'Unknown Surgeon';

        // Check if it looks like an ID (Firebase IDs are longer)
        if (surgeonId.length < 15) {
            // Probably a legacy name, return as is
            return surgeonId;
        }

        // Try to find surgeon by ID
        if (window.app.surgeonManager && window.app.surgeonManager.currentSurgeons) {
            const surgeon = window.app.surgeonManager.currentSurgeons.find(s => s.id === surgeonId);
            if (surgeon) {
                return `${surgeon.title || 'Dr.'} ${surgeon.full_name}`;
            }
        }

        // Fallback: if surgeon not found, return the ID (shouldn't happen in normal use)
        return surgeonId;
    }

    // Helper methods for dashboard tray cards
    isCheckedIn(tray) {
        return isCheckedInStatus(tray.status) || isInUseStatus(tray.status);
    }

    getTrayFacility(tray) {
        return tray.facility_id || tray.facility || '';
    }

    getFacilityName(facilityId) {
        if (!facilityId) return 'No Facility Assigned';
        
        // Try facilityManager first
        if (window.app.facilityManager && window.app.facilityManager.currentFacilities) {
            const facility = window.app.facilityManager.currentFacilities.find(f => f.id === facilityId);
            if (facility) {
                return facility.account_name;
            }
        }
        
        // Fallback to dataManager
        if (window.app.dataManager) {
            const facilities = window.app.dataManager.getFacilities();
            if (facilities && facilities.length > 0) {
                const facility = facilities.find(f => f.id === facilityId);
                if (facility) {
                    return facility.account_name;
                }
            }
        }
        
        // If it looks like a name already, return as-is
        if (facilityId.includes(' ') || facilityId.length > 25) {
            return facilityId;
        }
        
        // Final fallback
        return `Unknown Facility (${facilityId})`;
    }

    // Add this method to ViewManager class if it doesn't exist
    getSurgeonPreferredCasesText(preferredCases) {
        if (!preferredCases) return 'Any';

        // If it's comma-separated IDs
        if (preferredCases.includes(',') || preferredCases.length > 15) {
            const caseTypeIds = preferredCases.split(',').map(id => id.trim()).filter(id => id);
            const caseTypeNames = [];

            if (window.app.dataManager && window.app.dataManager.caseTypes) {
                caseTypeIds.forEach(id => {
                    const caseType = window.app.dataManager.caseTypes.find(ct => ct.id === id);
                    if (caseType) {
                        caseTypeNames.push(caseType.name);
                    }
                });
            }

            return caseTypeNames.length > 0 ? caseTypeNames.join(', ') : 'Loading...';
        }

        // Legacy text format
        return preferredCases;
    }

    getTrayActions(tray) {
        let actions = '';

        if (isAvailableStatus(tray.status) || normalizeStatus(tray.status) === TRAY_STATUS.PICKED_UP) {
            actions += `
                <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                    <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
            `;
        }

        if (isInUseStatus(tray.status)) {
            actions += `
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                    <i class="fas fa-hand-paper"></i> Pickup
                </button>
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                    <i class="fas fa-exchange-alt"></i> Turnover
                </button>
            `;
        }

        if (normalizeStatus(tray.status) === TRAY_STATUS.CHECKED_IN) {
            actions += `
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                    <i class="fas fa-hand-paper"></i> Pickup
                </button>
            `;
        }

        if (normalizeStatus(tray.status) === TRAY_STATUS.READY_FOR_PICKUP) {
            actions += `
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                    <i class="fas fa-hand-paper"></i> Pickup
                </button>
            `;
        }

        actions += `
            <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showHistoryModal('${tray.id}')">
                <i class="fas fa-history"></i> History
            </button>
        `;

        return actions;
    }

    getInitials(name) {
        if (!name) return '??';
        return name.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    getRoleClass(role) {
        // Role classes for different badge colors
        const roleClasses = {
            [USER_ROLES.TERRITORY_MANAGER]: 'admin',
            [USER_ROLES.SALES_REP]: 'rep',
            [USER_ROLES.CLINICAL_SPECIALIST]: 'specialist',
            [USER_ROLES.MANAGER]: 'manager',
            [USER_ROLES.ADMIN]: 'admin'
        };
        return roleClasses[role] || 'rep';
    }

    handleUsersUpdate(users) {
        // Re-render team view if it's currently visible
        if (this.currentView === 'team') {
            this.renderTeamMembers(users);
        }
    }

    updateTrayStats(trays) {
        const stats = {
            active: trays.length,
            available: trays.filter(t => t.status === 'available').length,
            inUse: trays.filter(t => t.status === 'in-use' || t.status === 'in_use').length,
            corporate: trays.filter(t => t.location === TRAY_LOCATIONS.CORPORATE).length
        };

        // Update dashboard metrics
        const activeTrayCount = document.getElementById('activeTrayCount');
        const availableCount = document.getElementById('availableCount');
        const inUseCount = document.getElementById('inUseCount');
        const corporateCount = document.getElementById('corporateCount');

        if (activeTrayCount) activeTrayCount.textContent = stats.active;
        if (availableCount) availableCount.textContent = stats.available;
        if (inUseCount) inUseCount.textContent = stats.inUse;
        if (corporateCount) corporateCount.textContent = stats.corporate;
    }

    updateRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon move">
                        <i class="fas fa-info"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">No recent activity</div>
                        <div class="activity-time">System ready</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        activities.slice(0, 5).forEach(activity => {
            const activityItem = this.createActivityItem(activity);
            container.appendChild(activityItem);
        });
    }

    async loadRecentActivity() {
        try {
            if (!window.app.dataManager) {
                console.error('❌ DataManager not available');
                this.updateRecentActivity([]);
                return;
            }
            
            const activities = await window.app.dataManager.getAllRecentActivity(10);
            
            if (!activities || activities.length === 0) {
                this.updateRecentActivity([]);
                return;
            }
                
            // Transform the activity data to match the expected format
            const transformedActivities = activities.map(activity => {
                let description = activity.details;
                if (activity.source === 'tray' && activity.trayName) {
                    description = `${activity.trayName}: ${activity.details}`;
                }
                
                const transformed = {
                    type: activity.action || 'unknown',
                    description: description,
                    timestamp: activity.timestamp,
                    user: activity.user || 'Unknown User'
                };
                
                return transformed;
            });
            
            this.updateRecentActivity(transformedActivities);
        } catch (error) {
            console.error('❌ Error loading recent activity:', error);
            console.error('❌ Error stack:', error.stack);
            // Show the default "no recent activity" state
            this.updateRecentActivity([]);
        }
    }

    handleActivitiesUpdate(activities) {
        
        // Transform activities to the format expected by updateRecentActivity
        const transformedActivities = activities.map(activity => {
            let description = activity.details;
            if (activity.source === 'tray' && activity.trayName) {
                description = `${activity.trayName}: ${activity.details}`;
            }
            
            return {
                trayName: activity.trayName || activity.source || 'System',
                action: activity.action,
                description: description,
                time: activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp),
                photoUrl: activity.photoUrl
            };
        });

        // Update the dashboard activities card if currently viewing dashboard
        if (this.currentView === 'dashboard') {
            this.updateRecentActivity(transformedActivities);
        }
    }

    async backfillTrayHistoryIfNeeded() {
        try {
            // Check if backfill has already been done
            const backfillKey = 'tray_history_backfill_completed';
            if (localStorage.getItem(backfillKey) === 'true') {
                console.log('Tray history backfill already completed, skipping...');
                return;
            }
            
            // Perform backfill
            if (window.app.dataManager) {
                console.log('Starting tray history backfill...');
                const backfilledCount = await window.app.dataManager.backfillTrayHistory();
                
                if (backfilledCount > 0) {
                    console.log(`Backfilled ${backfilledCount} trays with history`);
                    // Mark backfill as completed
                    localStorage.setItem(backfillKey, 'true');
                    
                    // Reload recent activity to show the new data
                    setTimeout(() => {
                        this.loadRecentActivity();
                    }, 2000); // Wait 2 seconds for Firestore to update
                }
            }
        } catch (error) {
            console.error('Error during backfill check:', error);
        }
    }

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';

        const iconClass = this.getActivityIconClass(activity.type);
        const timeAgo = this.getTimeAgo(activity.timestamp);

        item.innerHTML = `
            <div class="activity-icon ${iconClass}">
                <i class="${this.getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.description}</div>
                <div class="activity-user">${activity.user}</div>
                <div class="activity-time">${timeAgo}</div>
            </div>
        `;

        return item;
    }

    getActivityIconClass(type) {
        const classes = {
            'move': 'move',
            'assign': 'assign',
            'schedule': 'schedule',
            'checkin': 'move',
            'pickup': 'assign',
            'created': 'schedule'
        };
        return classes[type] || 'move';
    }

    getActivityIcon(type) {
        const icons = {
            'move': 'fas fa-arrow-right',
            'assign': 'fas fa-user',
            'schedule': 'fas fa-calendar',
            'checkin': 'fas fa-sign-in-alt',
            'pickup': 'fas fa-hand-paper',
            'created': 'fas fa-plus'
        };
        return icons[type] || 'fas fa-info';
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';

        const now = new Date();
        const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffMs = now - time;

        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    // Initialize URL routing
    async initializeRouting() {
        // Detect routing strategy first
        this.routingStrategy = await routingDetector.detectRoutingStrategy();
        
        // Set up event listeners based on strategy
        if (this.routingStrategy === 'clean') {
            // Handle browser back/forward buttons for clean URLs
            window.addEventListener('popstate', (event) => {
                const viewName = this.getViewFromUrl();
                this.showView(viewName, false);
            });
        } else {
            // Handle hash changes for hash URLs
            window.addEventListener('hashchange', (event) => {
                const viewName = this.getViewFromUrl();
                this.showView(viewName, false);
            });
            
            // Also handle popstate for hash URLs
            window.addEventListener('popstate', (event) => {
                const viewName = this.getViewFromUrl();
                this.showView(viewName, false);
            });
        }

        // Update navigation links based on detected strategy
        this.updateNavigationStrategy();

        // Handle initial page load routing
        const initialView = this.getViewFromUrl();
        if (initialView !== 'dashboard') {
            setTimeout(() => {
                this.showView(initialView, false); // Don't update URL on initial load
            }, 100);
        }
    }

    // Get view name from current URL
    getViewFromUrl() {
        const validViews = ['dashboard', 'team', 'map', 'trays', 'users', 'facilityAdmin', 'surgeons', 'physicians', 'casetypes', 'implanttypes', 'cases', 'migrations', 'admin_data_migrations'];
        
        if (this.routingStrategy === 'clean') {
            // Clean URLs: check pathname
            const path = window.location.pathname;
            if (path === '/') {
                return 'dashboard';
            }
            
            // Remove leading slash and check if it's a valid view
            const viewName = path.substring(1);
            if (validViews.includes(viewName)) {
                return viewName;
            }
        } else {
            // Hash URLs: check hash
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const viewName = hash.substring(1); // Remove the # symbol
                if (validViews.includes(viewName)) {
                    return viewName;
                }
            }
        }
        
        return 'dashboard'; // Default view
    }

    // Update navigation links based on detected routing strategy
    updateNavigationStrategy() {
        const navItems = [
            { id: 'nav-dashboard', view: 'dashboard' },
            { id: 'nav-team', view: 'team' },
            { id: 'nav-facilities', view: 'map' },
            { id: 'nav-trays', view: 'trays' },
            { id: 'nav-users', view: 'users' },
            { id: 'nav-facilityAdmin', view: 'facilityAdmin' },
            { id: 'nav-surgeons', view: 'surgeons' },
            { id: 'nav-map', view: 'map' },
            { id: 'nav-casetypes', view: 'casetypes' },
            { id: 'nav-cases', view: 'cases' }
        ];

        navItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (element) {
                // Update href attribute based on routing strategy
                if (this.routingStrategy === 'clean') {
                    const href = item.view === 'dashboard' ? '/' : `/${item.view}`;
                    element.setAttribute('href', href);
                } else {
                    const href = item.view === 'dashboard' ? '/' : `#${item.view}`;
                    element.setAttribute('href', href);
                }
                
                // Remove any existing click handlers by cloning the element
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                
                // Add click handler to prevent default behavior and handle routing properly
                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log(`Navigation clicked: ${item.view}, strategy: ${this.routingStrategy}`);
                    this.showView(item.view, true);
                });
            }
        });

        // Also update dropdown items without navigation IDs
        const dropdownViews = ['users', 'facilityAdmin', 'surgeons', 'physicians', 'cases', 'casetypes', 'implanttypes', 'admin_data_migrations'];
        dropdownViews.forEach(view => {
            const elements = document.querySelectorAll(`a[href="#${view}"], a[href="/${view}"]`);
            elements.forEach(element => {
                // Skip if this element already has a nav-id (handled above)
                if (!element.id || !element.id.startsWith('nav-')) {
                    if (this.routingStrategy === 'clean') {
                        element.setAttribute('href', `/${view}`);
                    } else {
                        element.setAttribute('href', `#${view}`);
                    }
                    
                    // Add click handler for dropdown items too
                    element.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log(`Dropdown navigation clicked: ${view}`);
                        this.showView(view, true);
                    });
                }
            });
        });

        console.log(`🔗 Updated navigation links for ${this.routingStrategy} URLs`);
    }

    async initializeRouting() {
        console.log('Initializing routing system...');
        
        // Detect routing strategy
        this.routingStrategy = await routingDetector.detectRoutingStrategy();
        console.log(`Routing strategy detected: ${this.routingStrategy}`);
        
        // Set up navigation with the detected strategy
        this.updateNavigationStrategy();
        
        // Handle initial page load - check URL and navigate to correct view
        this.handleInitialLoad();
        
        // Set up browser history listeners
        this.setupHistoryListeners();
    }
    
    handleInitialLoad() {
        console.log('🚀 Handling initial page load...');
        console.log('Current URL:', window.location.href);
        
        let initialView = 'dashboard';
        
        // Check current URL to determine initial view
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        if (this.routingStrategy === 'clean') {
            // Clean URLs: /cases, /trays, etc.
            if (currentPath !== '/' && currentPath !== '') {
                const pathView = currentPath.substring(1); // Remove leading slash
                if (this.isValidView(pathView)) {
                    initialView = pathView;
                } else {
                    console.log('❌ Invalid path view rejected:', pathView);
                }
            }
        } else {
            // Hash URLs: #cases, #trays, etc.
            console.log('Using hash URL detection...');
            if (currentHash && currentHash.length > 1) {
                const hashView = currentHash.substring(1); // Remove leading #
                console.log('Hash view detected:', hashView);
                if (this.isValidView(hashView)) {
                    initialView = hashView;
                    console.log('✅ Valid hash view accepted:', hashView);
                } else {
                    console.log('❌ Invalid hash view rejected:', hashView);
                }
            }
        }
        
        
        // Navigate to the determined view without updating URL (to avoid double navigation)
        this.isInitialLoad = true;
        this.showView(initialView, false);
        this.isInitialLoad = false;
        
    }
    
    isValidView(viewName) {
        const validViews = [
            'dashboard', 'team', 'facilities', 'trays', 'users',
            'facilityAdmin', 'surgeons', 'physicians', 'map', 'casetypes', 'implanttypes', 'cases', 'migrations', 'admin_data_migrations'
        ];
        return validViews.includes(viewName);
    }
    
    setupHistoryListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            console.log('Browser navigation detected (popstate)');
            
            let targetView = 'dashboard';
            
            if (this.routingStrategy === 'clean') {
                const path = window.location.pathname;
                if (path !== '/' && path !== '') {
                    const pathView = path.substring(1);
                    if (this.isValidView(pathView)) {
                        targetView = pathView;
                    }
                }
            } else {
                const hash = window.location.hash;
                if (hash && hash.length > 1) {
                    const hashView = hash.substring(1);
                    if (this.isValidView(hashView)) {
                        targetView = hashView;
                    }
                }
            }
            
            // Navigate without updating URL (it's already changed by browser)
            this.showView(targetView, false);
        });
        
        // Handle hash changes for hash-based routing
        if (this.routingStrategy === 'hash') {
            window.addEventListener('hashchange', (event) => {
                console.log('Hash change detected');
                
                const hash = window.location.hash;
                let targetView = 'dashboard';
                
                if (hash && hash.length > 1) {
                    const hashView = hash.substring(1);
                    if (this.isValidView(hashView)) {
                        targetView = hashView;
                    }
                }
                
                // Navigate without updating URL (it's already changed)
                this.showView(targetView, false);
            });
        }
        
    }

    async initializeAdminDataMigrationsView() {
        console.log('Initializing admin data migrations view');

        const migrationsView = document.getElementById('admin_data_migrationsView');
        if (!migrationsView) return;

        // Show loading state while checking authentication
        migrationsView.innerHTML = `
            <div class="container-fluid">
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center">
                        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3">Verifying access permissions...</p>
                    </div>
                </div>
            </div>
        `;

        // Wait for authentication to be ready
        const currentUser = await this.waitForAuthentication();

        // Check if user has admin role
        if (!currentUser || currentUser.role !== USER_ROLES.ADMIN) {
            console.warn('Access denied: Data migrations page requires admin role', {
                hasUser: !!currentUser,
                userRole: currentUser?.role,
                requiredRole: USER_ROLES.ADMIN
            });

            migrationsView.innerHTML = `
                <div class="container-fluid">
                    <div class="row justify-content-center">
                        <div class="col-md-6">
                            <div class="alert alert-danger text-center">
                                <i class="fas fa-lock fa-2x mb-3"></i>
                                <h4>Access Denied</h4>
                                <p>This page requires Administrator privileges.</p>
                                <p class="small text-muted">Current role: ${currentUser?.role || 'Not authenticated'}</p>
                                <button class="btn btn-primary" onclick="window.app.viewManager.showView('dashboard')">
                                    <i class="fas fa-arrow-left"></i> Go to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Create the migrations interface (migrationsView already declared at top)
        migrationsView.innerHTML = `
                <div class="container-fluid">
                    <div class="row mb-4">
                        <div class="col">
                            <h2><i class="fas fa-database"></i> Data Migrations</h2>
                            <p class="text-muted">Manage and execute data migrations for the system</p>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-tag"></i> Tray Name Migration</h5>
                                </div>
                                <div class="card-body">
                                    <p>Migrates tray <code>name</code> field to <code>tray_name</code> to match MyRepData format.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkTrayNameMigrationStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runTrayNameMigrationFromUI()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="trayNameMigrationStatus" class="alert alert-secondary d-none"></div>
                                    <div id="trayNameMigrationResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-clock"></i> Tray Timestamp Migration</h5>
                                </div>
                                <div class="card-body">
                                    <p>Migrates tray timestamps from <code>createdAt/updatedAt</code> to <code>created_at/updated_at</code>.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkTrayTimestampMigrationStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runTrayTimestampMigrationFromUI()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="trayTimestampMigrationStatus" class="alert alert-secondary d-none"></div>
                                    <div id="trayTimestampMigrationResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-building"></i> Facility ID Null Removal</h5>
                                </div>
                                <div class="card-body">
                                    <p>Removes <code>id: null</code> fields from facility documents that prevent proper ID resolution in dropdowns.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkFacilityIdNullStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runFacilityIdNullRemovalFromUI()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="facilityIdNullStatus" class="alert alert-secondary d-none"></div>
                                    <div id="facilityIdNullResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-map-marker-alt"></i> Facility Geocoding</h5>
                                </div>
                                <div class="card-body">
                                    <p>Geocodes facility addresses to update missing or invalid <code>latitude</code> and <code>longitude</code> coordinates.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkFacilityGeocodingStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runFacilityGeocodingFromUI()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="facilityGeocodingStatus" class="alert alert-secondary d-none"></div>
                                    <div id="facilityGeocodingResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row mt-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-edit"></i> Facility Name to Account Name</h5>
                                </div>
                                <div class="card-body">
                                    <p>Moves data from <code>facilities.name</code> to <code>facilities.account_name</code> field for consistency.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkFacilityNameToAccountNameStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runFacilityNameToAccountNameFromUI()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="facilityNameToAccountNameStatus" class="alert alert-secondary d-none"></div>
                                    <div id="facilityNameToAccountNameResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-user-md"></i> Physician Activation</h5>
                                </div>
                                <div class="card-body">
                                    <p>Activates all physicians by setting <code>active: true</code> for those with <code>active: false</code>.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkPhysicianActivationStatusFromUI()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-success" onclick="activateAllPhysiciansFromUI()">
                                            <i class="fas fa-user-check"></i> Activate All
                                        </button>
                                    </div>
                                    <div id="physicianActivationStatus" class="alert alert-secondary d-none"></div>
                                    <div id="physicianActivationResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row mt-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-clock"></i> Physician Timestamp Migration</h5>
                                </div>
                                <div class="card-body">
                                    <p>Migrates physician timestamps from <code>createdAt</code> to <code>created_at</code> for database consistency.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-info btn-sm" onclick="checkPhysicianTimestampMigrationStatus()">
                                            <i class="fas fa-search"></i> Check Status
                                        </button>
                                        <button class="btn btn-primary" onclick="runPhysicianTimestampMigration()">
                                            <i class="fas fa-play"></i> Run Migration
                                        </button>
                                    </div>
                                    <div id="physicianTimestampMigrationStatus" class="alert alert-secondary d-none"></div>
                                    <div id="physicianTimestampMigrationResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <!-- Empty column for spacing -->
                        </div>
                    </div>

                    <!-- Duplicate Tray Detection & Cleanup -->
                    <div class="row mt-4">
                        <div class="col">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-copy"></i> Duplicate Tray Detection & Cleanup</h5>
                                </div>
                                <div class="card-body">
                                    <p class="mb-3">Find and remove duplicate tray entries that share the same tray_id or tray_name.</p>

                                    <!-- Status Alert -->
                                    <div class="alert alert-info mb-3">
                                        <i class="fas fa-info-circle"></i>
                                        <strong>Status:</strong> <span id="duplicateStatusText">Click "Scan for Duplicates" to check for duplicate trays</span>
                                    </div>

                                    <!-- Metrics Row -->
                                    <div class="row mb-3">
                                        <div class="col-md-3">
                                            <div class="text-center p-3 border rounded bg-light">
                                                <div class="h4 mb-1 text-primary" id="totalTraysScanned">-</div>
                                                <div class="small text-muted">Total Trays</div>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center p-3 border rounded bg-light">
                                                <div class="h4 mb-1 text-success" id="uniqueTraysFound">-</div>
                                                <div class="small text-muted">Unique Trays</div>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center p-3 border rounded bg-light">
                                                <div class="h4 mb-1 text-warning" id="duplicateTraysFound">-</div>
                                                <div class="small text-muted">Duplicate Trays</div>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <div class="text-center p-3 border rounded bg-light">
                                                <div class="h4 mb-1 text-danger" id="duplicateGroupsFound">-</div>
                                                <div class="small text-muted">Duplicate Groups</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="mb-3">
                                        <button class="btn btn-outline-primary me-2" id="scanDuplicatesBtn" onclick="scanForDuplicateTrays()">
                                            <i class="fas fa-search"></i> Scan for Duplicates
                                        </button>
                                        <button class="btn btn-warning me-2" id="previewCleanupBtn" onclick="previewDuplicateCleanup()" disabled>
                                            <i class="fas fa-eye"></i> Preview Cleanup
                                        </button>
                                        <button class="btn btn-danger" id="cleanupDuplicatesBtn" onclick="cleanupDuplicateTrays()" disabled>
                                            <i class="fas fa-trash"></i> Remove Duplicates
                                        </button>
                                    </div>

                                    <!-- Progress Bar -->
                                    <div id="duplicateProgressContainer" class="d-none mb-3">
                                        <label class="form-label">Scanning Progress:</label>
                                        <div class="progress mb-2">
                                            <div class="progress-bar" id="duplicateProgressBar" role="progressbar" style="width: 0%">0%</div>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <small id="duplicateProgressText">Ready to start...</small>
                                            <small id="duplicateProgressEta">ETA: --</small>
                                        </div>
                                    </div>

                                    <!-- Duplicate Results Table -->
                                    <div id="duplicateResultsContainer" class="d-none">
                                        <h6><i class="fas fa-list"></i> Duplicate Tray Groups</h6>
                                        <div class="table-responsive">
                                            <table class="table table-striped table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Tray Name</th>
                                                        <th>Tray ID</th>
                                                        <th>Count</th>
                                                        <th>Document IDs</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="duplicateTraysTableBody">
                                                    <!-- Results populated here -->
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- Cleanup Results -->
                                    <div id="duplicateCleanupResults" class="alert alert-success d-none">
                                        <h6><i class="fas fa-check-circle"></i> Cleanup Results</h6>
                                        <div class="row">
                                            <div class="col-md-3">
                                                <strong>Processed:</strong> <span id="cleanupResultProcessed">0</span>
                                            </div>
                                            <div class="col-md-3">
                                                <strong>Removed:</strong> <span id="cleanupResultRemoved">0</span>
                                            </div>
                                            <div class="col-md-3">
                                                <strong>Kept:</strong> <span id="cleanupResultKept">0</span>
                                            </div>
                                            <div class="col-md-3">
                                                <strong>Errors:</strong> <span id="cleanupResultErrors">0</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Demo Data Management -->
                    <div class="row mt-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-plus-circle"></i> Initialize Demo Data</h5>
                                </div>
                                <div class="card-body">
                                    <p>Creates sample data for testing and demonstration purposes including users, facilities, trays, and cases.</p>
                                    <div class="mb-3">
                                        <button class="btn btn-success" onclick="initializeDemoDataFromUI()">
                                            <i class="fas fa-plus-circle"></i> Initialize Demo Data
                                        </button>
                                    </div>
                                    <div id="initializeDemoResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-trash"></i> Clear Demo Data</h5>
                                </div>
                                <div class="card-body">
                                    <p class="text-danger">
                                        <strong>Warning:</strong> This will permanently delete all demo data including users, facilities, trays, and cases.
                                    </p>
                                    <div class="mb-3">
                                        <button class="btn btn-danger" onclick="clearDemoDataFromUI()">
                                            <i class="fas fa-trash"></i> Clear Demo Data
                                        </button>
                                    </div>
                                    <div id="clearDemoResult" class="alert d-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row mt-4">
                        <div class="col">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-terminal"></i> Console Output</h5>
                                </div>
                                <div class="card-body">
                                    <div id="migrationConsoleOutput" style="background: #1e1e1e; color: #fff; padding: 15px; border-radius: 4px; height: 300px; overflow-y: auto; font-family: 'Courier New', monospace;">
                                        Migration console output will appear here...
                                    </div>
                                    <button class="btn btn-secondary btn-sm mt-2" onclick="clearMigrationConsole()">
                                        <i class="fas fa-trash"></i> Clear Console
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Override console.log temporarily to capture output
            this.setupMigrationConsoleCapture();
    }
    
    setupMigrationConsoleCapture() {
        // Store original console methods
        const originalLog = console.log;
        const originalError = console.error;
        
        // Override console methods to also display in UI
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.appendToMigrationConsole('log', args.join(' '));
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            this.appendToMigrationConsole('error', args.join(' '));
        };
        
        // Store originals for restoration
        window._originalConsole = { log: originalLog, error: originalError };
    }
    
    appendToMigrationConsole(type, message) {
        const consoleOutput = document.getElementById('migrationConsoleOutput');
        if (consoleOutput) {
            const timestamp = new Date().toLocaleTimeString();
            const color = type === 'error' ? '#ff6b6b' : '#4ecdc4';
            const prefix = type === 'error' ? '❌' : '📝';

            consoleOutput.innerHTML += `
                <div style="color: ${color}; margin-bottom: 5px;">
                    [${timestamp}] ${prefix} ${message}
                </div>
            `;
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
    }

    /**
     * Clear all tray filters and navigate to trays view to show all trays
     */
    viewAllTrays() {
        console.log('🚀 viewAllTrays() called');
        // Set global flag to prevent initializeTraysView from overriding user filter
        window._trayViewShowingAllTrays = true;
        console.log('🎯 Set window._trayViewShowingAllTrays = true, current value:', window._trayViewShowingAllTrays);

        // Navigate to trays view
        console.log('🔄 About to call showView, flag value:', window._trayViewShowingAllTrays);
        this.showView('trays');
        console.log('✅ showView completed, flag value:', window._trayViewShowingAllTrays);

        // Clear filters and set to show all users after view loads
        setTimeout(() => {
            console.log('⏰ viewAllTrays timeout (200ms) executing');
            // Populate user filter with setToAllUsers flag
            console.log('📞 Calling populateTraysUserFilter(0, true) from viewAllTrays');
            this.populateTraysUserFilter(0, true);

            // Let the tray manager handle clearing other filters (but not user filter since we just set it)
            if (window.app.trayManager && window.app.trayManager.viewAllTrays) {
                // Don't call it since it will override our user filter setting
                console.log('⏭️ Skipping TrayManager.viewAllTrays to prevent user filter override');
                // Just clear the status filter manually
                const traysStatusFilter = document.getElementById('traysStatusFilter');
                if (traysStatusFilter) traysStatusFilter.value = '';
                // Refresh the display
                if (window.app.trayManager && window.app.trayManager.currentTrays) {
                    window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
                }
            }

            // Clear the flag after setup is complete
            window._trayViewShowingAllTrays = false;
            console.log('🏁 Cleared window._trayViewShowingAllTrays flag');
        }, 200);
    }

    getTrayTypeText(tray) {
        // Only show if tray is checked in - show the case type of the current case
        if (this.isCheckedIn(tray) && tray.assignedCaseId) {
            const currentCaseType = this.getCurrentCaseType(tray.assignedCaseId);
            if (currentCaseType) {
                return currentCaseType;
            }
        }

        // If not checked in, return null to hide the field
        return null;
    }

    getCurrentCaseType(caseId) {
        if (!caseId) return null;

        // Get the case from DataManager
        if (window.app?.dataManager?.getCases) {
            const cases = window.app.dataManager.getCases();
            const currentCase = cases.find(c => c.id === caseId);

            if (currentCase && currentCase.caseTypeId) {
                // Get the case type name
                return this.getCaseTypeName(currentCase.caseTypeId);
            }
        }

        return null;
    }

    getCaseTypeName(caseTypeId) {
        if (!caseTypeId) return null;

        // Get case types from DataManager
        if (window.app?.dataManager?.getCaseTypes) {
            const caseTypes = window.app.dataManager.getCaseTypes();
            const caseType = caseTypes.find(ct => ct.id === caseTypeId);
            return caseType?.name || null;
        }

        return null;
    }

    getCaseTypeCompatibilityText(tray) {
        if (!tray.case_type_compatibility || !Array.isArray(tray.case_type_compatibility) || tray.case_type_compatibility.length === 0) {
            return null;
        }

        // Convert case type IDs to names
        const caseTypeNames = tray.case_type_compatibility.map(caseTypeId => {
            return this.getCaseTypeName(caseTypeId);
        }).filter(name => name); // Filter out null/undefined names

        if (caseTypeNames.length === 0) {
            return null;
        }

        return `Compatible with: ${caseTypeNames.join(', ')}`;
    }

    /**
     * Wait for authentication to be ready and return current user
     * @returns {Promise<Object|null>} Current user data or null
     */
    async waitForAuthentication() {
        const maxAttempts = 50; // 5 seconds max
        let attempts = 0;

        return new Promise((resolve) => {
            const checkAuth = () => {
                attempts++;

                // Check if auth manager exists and has current user
                const authManager = window.app?.authManager;
                const currentUser = authManager?.currentUser;

                if (currentUser) {
                    console.log('✅ Authentication ready:', {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        role: currentUser.role,
                        attempts: attempts
                    });
                    resolve(currentUser);
                    return;
                }

                // Check if we've exceeded max attempts
                if (attempts >= maxAttempts) {
                    console.warn('⚠️ Authentication timeout after', attempts, 'attempts');
                    resolve(null);
                    return;
                }

                // Wait and try again
                setTimeout(checkAuth, 100);
            };

            checkAuth();
        });
    }
}

// Global functions for demo data UI interactions
window.initializeDemoDataFromUI = async function() {
    try {
        const resultDiv = document.getElementById('initializeDemoResult');
        if (!resultDiv) {
            console.error('Result div not found');
            return;
        }

        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing demo data...';

        // Call the demo manager
        if (!window.app?.demoManager) {
            throw new Error('Demo manager not available');
        }

        await window.app.demoManager.initializeDemoData();

        resultDiv.className = 'alert alert-success';
        resultDiv.innerHTML = `
            <i class="fas fa-check"></i> Demo data initialized successfully!<br>
            <small>Created sample users, facilities, trays, and cases for testing.</small>
        `;

    } catch (error) {
        const resultDiv = document.getElementById('initializeDemoResult');
        if (resultDiv) {
            resultDiv.className = 'alert alert-danger';
            resultDiv.classList.remove('d-none');
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Error initializing demo data: ${error.message}`;
        }
        console.error('Error initializing demo data:', error);
    }
};

window.clearDemoDataFromUI = async function() {
    if (!confirm('Are you sure you want to clear all demo data? This action cannot be undone.')) {
        return;
    }

    try {
        const resultDiv = document.getElementById('clearDemoResult');
        if (!resultDiv) {
            console.error('Result div not found');
            return;
        }

        resultDiv.className = 'alert alert-info';
        resultDiv.classList.remove('d-none');
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing demo data...';

        // Call the demo manager
        if (!window.app?.demoManager) {
            throw new Error('Demo manager not available');
        }

        await window.app.demoManager.clearDemoData();

        resultDiv.className = 'alert alert-success';
        resultDiv.innerHTML = `
            <i class="fas fa-check"></i> Demo data cleared successfully!<br>
            <small>All demo users, facilities, trays, and cases have been removed.</small>
        `;

    } catch (error) {
        const resultDiv = document.getElementById('clearDemoResult');
        if (resultDiv) {
            resultDiv.className = 'alert alert-danger';
            resultDiv.classList.remove('d-none');
            resultDiv.innerHTML = `<i class="fas fa-times"></i> Error clearing demo data: ${error.message}`;
        }
        console.error('Error clearing demo data:', error);
    }
};