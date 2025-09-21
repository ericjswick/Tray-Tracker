// js/utils/DuplicateTrayManager.js - Duplicate Tray Detection and Cleanup Utilities

import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

export class DuplicateTrayManager {
    constructor(db) {
        this.db = db;
        this.duplicateGroups = [];
        this.scanResults = null;
    }

    // Scan for duplicate trays
    async scanForDuplicateTrays() {
        try {
            console.log('🔍 Starting duplicate tray scan...');

            // Update UI
            this.updateStatus('Scanning database for duplicate trays...', 'info');
            this.showProgress();
            this.updateProgress(0, 'Loading trays from database...');

            // Get all trays from database without deduplication
            const traysSnapshot = await getDocs(collection(this.db, 'tray_tracking'));
            const rawTrays = [];
            traysSnapshot.forEach((doc) => {
                const trayData = {
                    firebaseId: doc.id,
                    ...doc.data()
                };
                rawTrays.push(trayData);
            });

            console.log(`📊 Found ${rawTrays.length} total tray documents`);
            this.updateProgress(25, `Analyzing ${rawTrays.length} tray documents...`);

            // Group trays by tray_id and tray_name to find duplicates
            const trayIdGroups = {};
            const trayNameGroups = {};

            rawTrays.forEach((tray, index) => {
                // Update progress
                if (index % 10 === 0) {
                    const progress = 25 + (index / rawTrays.length) * 50;
                    this.updateProgress(progress, `Analyzing tray ${index + 1} of ${rawTrays.length}...`);
                }

                const trayId = tray.tray_id || tray.id;
                const trayName = tray.tray_name || tray.name;

                // Group by tray_id
                if (trayId) {
                    if (!trayIdGroups[trayId]) {
                        trayIdGroups[trayId] = [];
                    }
                    trayIdGroups[trayId].push(tray);
                }

                // Group by tray_name
                if (trayName) {
                    if (!trayNameGroups[trayName]) {
                        trayNameGroups[trayName] = [];
                    }
                    trayNameGroups[trayName].push(tray);
                }
            });

            this.updateProgress(75, 'Identifying duplicate groups...');

            // Find groups with duplicates
            const duplicateGroups = [];

            // Check tray_id duplicates
            Object.entries(trayIdGroups).forEach(([trayId, trays]) => {
                if (trays.length > 1) {
                    duplicateGroups.push({
                        type: 'tray_id',
                        identifier: trayId,
                        displayName: trays[0].tray_name || trays[0].name || trayId,
                        trays: trays,
                        count: trays.length
                    });
                }
            });

            // Check tray_name duplicates (only if not already covered by tray_id)
            Object.entries(trayNameGroups).forEach(([trayName, trays]) => {
                if (trays.length > 1) {
                    // Check if this is already covered by tray_id duplicates
                    const firstTrayId = trays[0].tray_id || trays[0].id;
                    const existsInTrayIdDuplicates = duplicateGroups.some(group =>
                        group.type === 'tray_id' && group.identifier === firstTrayId
                    );

                    if (!existsInTrayIdDuplicates) {
                        duplicateGroups.push({
                            type: 'tray_name',
                            identifier: trayName,
                            displayName: trayName,
                            trays: trays,
                            count: trays.length
                        });
                    }
                }
            });

            this.updateProgress(100, 'Scan completed!');

            // Calculate results
            const totalTrays = rawTrays.length;
            const duplicateTraysCount = duplicateGroups.reduce((sum, group) => sum + group.count, 0);
            const uniqueTraysCount = totalTrays - duplicateTraysCount + duplicateGroups.length; // Remove duplicates, keep one per group

            this.scanResults = {
                totalTrays,
                uniqueTraysCount,
                duplicateTraysCount,
                duplicateGroupsCount: duplicateGroups.length,
                duplicateGroups
            };

            this.duplicateGroups = duplicateGroups;

            // Update UI
            this.displayScanResults();
            this.hideProgress();

            console.log(`✅ Scan completed: ${duplicateGroups.length} duplicate groups found`);

            if (duplicateGroups.length === 0) {
                this.updateStatus('No duplicate trays found! Database is clean.', 'success');
            } else {
                this.updateStatus(`Found ${duplicateGroups.length} duplicate groups affecting ${duplicateTraysCount} tray documents.`, 'warning');
            }

        } catch (error) {
            console.error('❌ Error scanning for duplicates:', error);
            this.updateStatus(`Error during scan: ${error.message}`, 'error');
            this.hideProgress();
        }
    }

    // Preview what will be cleaned up
    previewDuplicateCleanup() {
        if (!this.duplicateGroups || this.duplicateGroups.length === 0) {
            alert('No duplicates found. Please scan first.');
            return;
        }

        let previewText = 'DUPLICATE CLEANUP PREVIEW\n\n';
        previewText += `Found ${this.duplicateGroups.length} duplicate groups:\n\n`;

        this.duplicateGroups.forEach((group, index) => {
            previewText += `${index + 1}. ${group.displayName} (${group.type}: ${group.identifier})\n`;
            previewText += `   Documents: ${group.count}\n`;
            previewText += `   Firebase IDs: ${group.trays.map(t => t.firebaseId).join(', ')}\n`;
            previewText += `   Action: Keep newest, delete ${group.count - 1} older documents\n\n`;
        });

        previewText += 'Click "Remove Duplicates" to proceed with cleanup.';

        // Show in a modal or alert
        alert(previewText);
    }

    // Clean up duplicate trays
    async cleanupDuplicateTrays() {
        if (!this.duplicateGroups || this.duplicateGroups.length === 0) {
            alert('No duplicates found. Please scan first.');
            return;
        }

        const confirmMessage = `This will remove ${this.scanResults.duplicateTraysCount - this.duplicateGroups.length} duplicate tray documents.\n\nThis action cannot be undone. Continue?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            console.log('🧹 Starting duplicate cleanup...');
            this.updateStatus('Cleaning up duplicate trays...', 'info');
            this.showProgress();

            let processedGroups = 0;
            let removedCount = 0;
            let keptCount = 0;
            let errorCount = 0;

            for (const group of this.duplicateGroups) {
                processedGroups++;
                const progress = (processedGroups / this.duplicateGroups.length) * 100;
                this.updateProgress(progress, `Processing group ${processedGroups} of ${this.duplicateGroups.length}...`);

                try {
                    // Sort trays by creation date (keep newest)
                    const sortedTrays = [...group.trays].sort((a, b) => {
                        const dateA = a.created_at || a.createdAt || new Date(0);
                        const dateB = b.created_at || b.createdAt || new Date(0);
                        return new Date(dateB) - new Date(dateA); // Newest first
                    });

                    // Keep the first (newest) tray, delete the rest
                    const trayToKeep = sortedTrays[0];
                    const traysToDelete = sortedTrays.slice(1);

                    console.log(`📋 Group "${group.displayName}": Keeping ${trayToKeep.firebaseId}, deleting ${traysToDelete.length} others`);

                    // Delete duplicate documents
                    for (const trayToDelete of traysToDelete) {
                        try {
                            await deleteDoc(doc(this.db, 'tray_tracking', trayToDelete.firebaseId));
                            removedCount++;
                            console.log(`🗑️  Deleted duplicate: ${trayToDelete.firebaseId}`);
                        } catch (deleteError) {
                            console.error(`❌ Failed to delete ${trayToDelete.firebaseId}:`, deleteError);
                            errorCount++;
                        }
                    }

                    keptCount++;

                } catch (groupError) {
                    console.error(`❌ Error processing group ${group.displayName}:`, groupError);
                    errorCount++;
                }
            }

            this.hideProgress();

            // Update results
            const cleanupResults = {
                processed: processedGroups,
                removed: removedCount,
                kept: keptCount,
                errors: errorCount
            };

            this.displayCleanupResults(cleanupResults);

            if (errorCount === 0) {
                this.updateStatus(`Cleanup completed! Removed ${removedCount} duplicate documents, kept ${keptCount} unique trays.`, 'success');
            } else {
                this.updateStatus(`Cleanup completed with ${errorCount} errors. Removed ${removedCount} duplicates, kept ${keptCount} unique trays.`, 'warning');
            }

            // Clear scan results to force re-scan
            this.scanResults = null;
            this.duplicateGroups = [];
            this.resetButtons();

            console.log('✅ Duplicate cleanup completed');

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            this.updateStatus(`Error during cleanup: ${error.message}`, 'error');
            this.hideProgress();
        }
    }

    // UI Helper Methods
    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('duplicateStatusText');
        if (statusElement) {
            statusElement.textContent = message;

            const alertElement = statusElement.closest('.alert');
            if (alertElement) {
                alertElement.className = `alert alert-${type} mb-3`;
            }
        }
    }

    showProgress() {
        const container = document.getElementById('duplicateProgressContainer');
        if (container) {
            container.classList.remove('d-none');
        }
    }

    hideProgress() {
        const container = document.getElementById('duplicateProgressContainer');
        if (container) {
            container.classList.add('d-none');
        }
    }

    updateProgress(percent, text) {
        const progressBar = document.getElementById('duplicateProgressBar');
        const progressText = document.getElementById('duplicateProgressText');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.textContent = `${Math.round(percent)}%`;
        }

        if (progressText) {
            progressText.textContent = text;
        }
    }

    displayScanResults() {
        if (!this.scanResults) return;

        // Update metrics
        document.getElementById('totalTraysScanned').textContent = this.scanResults.totalTrays;
        document.getElementById('uniqueTraysFound').textContent = this.scanResults.uniqueTraysCount;
        document.getElementById('duplicateTraysFound').textContent = this.scanResults.duplicateTraysCount;
        document.getElementById('duplicateGroupsFound').textContent = this.scanResults.duplicateGroupsCount;

        // Show/hide results table
        const resultsContainer = document.getElementById('duplicateResultsContainer');
        if (this.scanResults.duplicateGroupsCount > 0) {
            resultsContainer.classList.remove('d-none');
            this.populateDuplicatesTable();
        } else {
            resultsContainer.classList.add('d-none');
        }

        // Enable/disable buttons
        const previewBtn = document.getElementById('previewCleanupBtn');
        const cleanupBtn = document.getElementById('cleanupDuplicatesBtn');

        if (this.scanResults.duplicateGroupsCount > 0) {
            previewBtn.disabled = false;
            cleanupBtn.disabled = false;
        } else {
            previewBtn.disabled = true;
            cleanupBtn.disabled = true;
        }
    }

    populateDuplicatesTable() {
        const tableBody = document.getElementById('duplicateTraysTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        this.duplicateGroups.forEach((group, index) => {
            const row = document.createElement('tr');

            const documentIds = group.trays.map(tray => tray.firebaseId).join(', ');
            const oldestDate = group.trays.map(t => t.created_at || t.createdAt || new Date(0))
                .reduce((oldest, current) => new Date(current) < new Date(oldest) ? current : oldest);

            row.innerHTML = `
                <td>
                    <strong>${group.displayName}</strong>
                    <br><small class="text-muted">${group.type}</small>
                </td>
                <td><code>${group.identifier}</code></td>
                <td>
                    <span class="badge bg-warning">${group.count}</span>
                </td>
                <td>
                    <small class="text-muted font-monospace">${documentIds}</small>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="duplicateTrayManager.cleanupSingleGroup(${index})">
                        <i class="fas fa-trash"></i> Clean This Group
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    displayCleanupResults(results) {
        const resultsContainer = document.getElementById('duplicateCleanupResults');
        if (resultsContainer) {
            resultsContainer.classList.remove('d-none');

            document.getElementById('cleanupResultProcessed').textContent = results.processed;
            document.getElementById('cleanupResultRemoved').textContent = results.removed;
            document.getElementById('cleanupResultKept').textContent = results.kept;
            document.getElementById('cleanupResultErrors').textContent = results.errors;
        }
    }

    resetButtons() {
        document.getElementById('previewCleanupBtn').disabled = true;
        document.getElementById('cleanupDuplicatesBtn').disabled = true;
    }

    // Clean up a single duplicate group
    async cleanupSingleGroup(groupIndex) {
        const group = this.duplicateGroups[groupIndex];
        if (!group) return;

        const confirmMessage = `Remove ${group.count - 1} duplicate documents for "${group.displayName}"?`;
        if (!confirm(confirmMessage)) return;

        try {
            // Sort trays by creation date (keep newest)
            const sortedTrays = [...group.trays].sort((a, b) => {
                const dateA = a.created_at || a.createdAt || new Date(0);
                const dateB = b.created_at || b.createdAt || new Date(0);
                return new Date(dateB) - new Date(dateA); // Newest first
            });

            const trayToKeep = sortedTrays[0];
            const traysToDelete = sortedTrays.slice(1);

            // Delete duplicates
            for (const trayToDelete of traysToDelete) {
                await deleteDoc(doc(this.db, 'tray_tracking', trayToDelete.firebaseId));
            }

            // Remove group from list
            this.duplicateGroups.splice(groupIndex, 1);

            // Refresh display
            this.scanResults.duplicateGroupsCount = this.duplicateGroups.length;
            this.displayScanResults();

            alert(`Cleaned up ${traysToDelete.length} duplicates for "${group.displayName}"`);

        } catch (error) {
            console.error('Error cleaning single group:', error);
            alert(`Error cleaning up group: ${error.message}`);
        }
    }
}

// Global functions for HTML onclick handlers
window.scanForDuplicateTrays = async function() {
    if (window.duplicateTrayManager) {
        await window.duplicateTrayManager.scanForDuplicateTrays();
    }
};

window.previewDuplicateCleanup = function() {
    if (window.duplicateTrayManager) {
        window.duplicateTrayManager.previewDuplicateCleanup();
    }
};

window.cleanupDuplicateTrays = async function() {
    if (window.duplicateTrayManager) {
        await window.duplicateTrayManager.cleanupDuplicateTrays();
    }
};