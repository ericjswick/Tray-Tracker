// js/ViewManager.js - Updated for Tray Tracker
import { routingDetector } from './utils/RoutingDetector.js';
import { isInUseStatus, isCheckedInStatus, populateTrayStatusDropdown } from './constants/TrayStatus.js';
import { populateFacilityTypeDropdown } from './constants/FacilityTypes.js';

export class ViewManager {
    constructor() {
        this.currentView = 'dashboard';
        this.routingStrategy = 'hash'; // Default to hash, will be detected
        this.isInitialLoad = true;
    }

    showView(viewName, updateUrl = true) {
        console.log('Switching to view:', viewName);

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
            console.log('View shown:', viewName);
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
            case 'cases':
                this.initializeCasesView();
                break;
            case 'migrations':
                this.initializeMigrationsView();
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

    initializeCasesView() {
        console.log('Initializing cases view');
        setTimeout(() => {
            if (window.app.casesManager) {
                try {
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
            
            // Set up dashboard filter listener
            const dashboardFilter = document.getElementById('dashboardStatusFilter');
            if (dashboardFilter) {
                dashboardFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        this.renderDashboardTrays(window.app.trayManager.currentTrays);
                    }
                });
            }
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
            
            // Set up trays page filter listener
            const traysFilter = document.getElementById('traysStatusFilter');
            if (traysFilter) {
                traysFilter.addEventListener('change', () => {
                    if (window.app.trayManager && window.app.trayManager.currentTrays) {
                        window.app.trayManager.renderTrays(window.app.trayManager.currentTrays);
                    }
                });
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
        setTimeout(() => {
            if (window.app.mapManager) {
                window.app.mapManager.initializeMap();
                if (window.app.trayManager.currentTrays) {
                    window.app.mapManager.updateMap(window.app.trayManager.currentTrays);
                }
            }
        }, 100);
    }

    renderDashboardTrays(trays) {
        const container = document.getElementById('dashboardTraysContent');
        if (!container) return;

        // Apply dashboard status filter
        const statusFilter = document.getElementById('dashboardStatusFilter')?.value || '';
        const filteredTrays = statusFilter ? 
            trays.filter(tray => tray.status === statusFilter) : 
            trays;

        if (filteredTrays.length === 0) {
            const message = statusFilter ? 
                `No trays found with status: ${statusFilter}` : 
                'No trays found. Add a new tray to get started.';
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-box fa-3x mb-3" style="color: var(--gray-300);"></i>
                    <p>${message}</p>
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
        const locationText = this.getLocationText(tray.location);

        card.innerHTML = `
            <div class="tray-card-header">
                <div class="tray-card-title">
                    <div class="tray-type-icon">
                        <i class="${typeIcon}"></i>
                    </div>
                    ${tray.name}
                </div>
                <span class="tray-status-badge ${statusClass}">${tray.status}</span>
            </div>
            <div class="tray-card-content">
                <div class="tray-detail">
                    ${this.isCheckedIn(tray) ? `
                        <i class="fas fa-hospital"></i>
                        <span class="tray-detail-value">${(() => {
                            const facilityId = this.getTrayFacility(tray);
                            const facilityName = this.getFacilityName(facilityId);
                            
                            // Debug for dashboard cards (using same pattern as TrayManager)
                            if (window.is_enable_api_logging && window.frontendLogger) {
                                // Dashboard HTML generation debugging available if needed
                            }
                            
                            return facilityName;
                        })()}</span>
                    ` : `
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="tray-detail-value">${locationText}</span>
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
                ${tray.surgeon ? `
                    <div class="tray-detail">
                        <i class="fas fa-user-md"></i>
                        <span class="tray-detail-value">${this.getSurgeonName(tray.surgeon)}</span>
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

    getLocationText(locationId) {
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
            'corporate': 'SI-BONE Corporate'
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
                return facility.name;
            }
        }
        
        // Fallback to dataManager
        if (window.app.dataManager) {
            const facilities = window.app.dataManager.getFacilities();
            if (facilities && facilities.length > 0) {
                const facility = facilities.find(f => f.id === facilityId);
                if (facility) {
                    return facility.name;
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

        if (tray.status === 'available') {
            actions += `
                <button class="btn-primary-custom btn-sm" onclick="app.modalManager.showCheckinModal('${tray.id}')">
                    <i class="fas fa-sign-in-alt"></i> Check-in
                </button>
            `;
        }

        if (tray.status === 'in-use' || tray.status === 'in_use') {
            actions += `
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showPickupModal('${tray.id}')">
                    <i class="fas fa-hand-paper"></i> Pickup
                </button>
                <button class="btn-secondary-custom btn-sm" onclick="app.modalManager.showTurnoverModal('${tray.id}')">
                    <i class="fas fa-exchange-alt"></i> Turnover
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
            'Territory Manager': 'admin',
            'Sales Rep': 'rep',
            'Clinical Specialist': 'specialist',
            'Manager': 'manager',
            'Admin': 'admin'
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
            corporate: trays.filter(t => t.location === 'corporate').length
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
        const validViews = ['dashboard', 'team', 'map', 'trays', 'users', 'facilityAdmin', 'surgeons', 'physicians', 'casetypes', 'cases', 'migrations'];
        
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
        const dropdownViews = ['users', 'facilityAdmin', 'surgeons', 'physicians', 'cases', 'casetypes'];
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
        console.log('Current pathname:', window.location.pathname);
        console.log('Current hash:', window.location.hash);
        console.log('Routing strategy:', this.routingStrategy);
        
        let initialView = 'dashboard';
        
        // Check current URL to determine initial view
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        if (this.routingStrategy === 'clean') {
            // Clean URLs: /cases, /trays, etc.
            console.log('Using clean URL detection...');
            if (currentPath !== '/' && currentPath !== '') {
                const pathView = currentPath.substring(1); // Remove leading slash
                console.log('Path view detected:', pathView);
                if (this.isValidView(pathView)) {
                    initialView = pathView;
                    console.log('✅ Valid path view accepted:', pathView);
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
        
        console.log(`🎯 Final initial view determined: ${initialView} (from ${this.routingStrategy === 'clean' ? 'path' : 'hash'})`);
        
        // Navigate to the determined view without updating URL (to avoid double navigation)
        this.isInitialLoad = true;
        this.showView(initialView, false);
        this.isInitialLoad = false;
        
        console.log('✅ Initial load completed');
    }
    
    isValidView(viewName) {
        const validViews = [
            'dashboard', 'team', 'facilities', 'trays', 'users', 
            'facilityAdmin', 'surgeons', 'physicians', 'map', 'casetypes', 'cases', 'migrations'
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
        
        console.log('History listeners set up for', this.routingStrategy, 'routing');
    }
}