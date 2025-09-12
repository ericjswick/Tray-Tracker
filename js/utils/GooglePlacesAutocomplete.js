// js/utils/GooglePlacesAutocomplete.js - Google Places Autocomplete Utility

export class GooglePlacesAutocomplete {
    constructor() {
        this.isLoaded = false;
        this.autocompleteInstances = new Map();
    }

    // Dynamically load the Google Places config based on environment
    async getGooglePlacesConfig() {
        try {
            // Determine which config file to load
            const envFile = window.ENVIRONMENT_VARIABLE_FILE || 'default';
            const configPath = `../../config/${envFile}.config.js`;
            
            console.log(`Loading Google Places config from: ${configPath}`);
            
            // Dynamic import of the config
            const configModule = await import(configPath);
            return configModule.googlePlacesConfig;
        } catch (error) {
            console.warn('Failed to load Google Places config, trying default:', error);
            try {
                // Fallback to default config
                const defaultConfig = await import('../../config/default.config.js');
                return defaultConfig.googlePlacesConfig;
            } catch (fallbackError) {
                console.error('Failed to load any Google Places config:', fallbackError);
                return null;
            }
        }
    }

    // Check if Google Places API is available and load it
    async loadGooglePlacesAPI() {
        // Get config dynamically
        const googlePlacesConfig = await this.getGooglePlacesConfig();
        
        // Check if API key is available
        if (!googlePlacesConfig?.apiKey) {
            console.log('Google Places API key not available - autocomplete disabled');
            return false;
        }

        console.log('Google Places API Key:', googlePlacesConfig.apiKey);

        // Check if already loaded
        if (this.isLoaded) {
            return true;
        }

        try {
            // Load Google Maps JavaScript API with Places library (new widget approach)
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googlePlacesConfig.apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;

            // Create a promise that resolves when the API is loaded
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    this.isLoaded = true;
                    console.log('Google Places API loaded successfully (new widget approach)');
                    resolve(true);
                };

                script.onerror = (error) => {
                    console.error('Failed to load Google Places API:', error);
                    reject(false);
                };

                document.head.appendChild(script);

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!this.isLoaded) {
                        console.warn('Google Places API load timeout');
                        reject(false);
                    }
                }, 10000);
            });
        } catch (error) {
            console.error('Error loading Google Places API:', error);
            return false;
        }
    }

    // Initialize autocomplete for facility address fields using new widget approach
    async initializeFacilityAutocomplete(addressFieldId, cityFieldId = null, stateFieldId = null, zipFieldId = null) {
        console.log(`🏥 Initializing Google Places autocomplete widget for ${addressFieldId}...`);
        
        // Get and display the current API key
        const googlePlacesConfig = await this.getGooglePlacesConfig();
        if (googlePlacesConfig?.apiKey) {
            console.log('🔑 Google Places API Key being used:', googlePlacesConfig.apiKey);
        }
        
        // Load API if not already loaded
        if (!this.isLoaded) {
            console.log('Loading Google Places API...');
            const loaded = await this.loadGooglePlacesAPI();
            if (!loaded) {
                console.warn('Google Places API could not be loaded - autocomplete disabled');
                return false;
            }
        }

        const addressField = document.getElementById(addressFieldId);
        if (!addressField) {
            console.warn(`Address field not found: ${addressFieldId}`);
            return false;
        }

        try {
            // Create search icon with popup approach
            console.log('🔧 Setting up search icon with popup for Google Places...');
            
            // Create container for input + search icon
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-group';
            inputContainer.style.position = 'relative';
            
            // Style the original input field
            addressField.placeholder = 'Street address (click search to find)';
            
            // Create search button
            const searchButton = document.createElement('button');
            searchButton.type = 'button';
            searchButton.className = 'btn btn-outline-secondary';
            searchButton.innerHTML = '<i class="fas fa-search"></i>';
            searchButton.title = 'Search for address';
            searchButton.style.borderLeft = 'none';
            searchButton.id = addressFieldId + '_search_btn'; // Add unique ID
            
            // Wrap input and button in container
            addressField.parentNode.insertBefore(inputContainer, addressField);
            inputContainer.appendChild(addressField);
            inputContainer.appendChild(searchButton);
            
            // Create popup modal
            this.createAddressSearchModal(addressFieldId, cityFieldId, stateFieldId, zipFieldId);
            
            // Add click listener to search button
            searchButton.addEventListener('click', () => {
                console.log('🔍 Opening address search popup...');
                this.openAddressSearchPopup(addressFieldId);
            });
            
            // Store reference for cleanup
            this.autocompleteInstances.set(addressFieldId, { searchButton, inputContainer });

            console.log(`Google Places autocomplete widget initialized for ${addressFieldId}`);
            return true;
        } catch (error) {
            console.error('Error initializing autocomplete widget:', error);
            return false;
        }
    }

    // Create address search modal
    createAddressSearchModal(addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        const modalId = `addressSearchModal_${addressFieldId}`;
        
        // Don't create if already exists
        if (document.getElementById(modalId)) {
            return;
        }
        
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}Label">
                                <i class="fas fa-search me-2"></i>Search for Address
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Start typing to search for an address:</label>
                                <div id="${modalId}_widget_container" style="width: 100%;"></div>
                            </div>
                            <div class="text-muted small">
                                <i class="fas fa-info-circle me-1"></i>
                                Select an address to automatically fill in the street, city, state, and zip fields.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log(`✅ Created address search modal: ${modalId}`);
    }

    // Open address search popup
    openAddressSearchPopup(addressFieldId) {
        const modalId = `addressSearchModal_${addressFieldId}`;
        const modal = document.getElementById(modalId);
        const widgetContainer = document.getElementById(`${modalId}_widget_container`);
        
        if (!modal || !widgetContainer) {
            console.error('❌ Modal or widget container not found');
            return;
        }
        
        // Clear any existing widget
        widgetContainer.innerHTML = '';
        
        // Create Google Places widget in the modal
        const autocompleteWidget = document.createElement('gmp-place-autocomplete');
        autocompleteWidget.setAttribute('placeholder', 'Start typing an address...');
        autocompleteWidget.style.width = '100%';
        autocompleteWidget.style.height = '42px';
        autocompleteWidget.className = 'form-control';
        
        widgetContainer.appendChild(autocompleteWidget);
        
        // Add selection listener
        autocompleteWidget.addEventListener('gmp-select', async (event) => {
            console.log('🎯 Address selected in popup');
            
            try {
                const { placePrediction } = event;
                if (placePrediction) {
                    const place = placePrediction.toPlace();
                    await place.fetchFields({
                        fields: ['displayName', 'formattedAddress', 'addressComponents', 'location']
                    });
                    
                    // Process the selection
                    const placeData = place.toJSON();
                    this.handlePopupSelection(placeData, addressFieldId, modalId);
                }
            } catch (error) {
                console.error('❌ Error processing popup selection:', error);
            }
        });
        
        // Show the modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Focus the widget after modal shows
        modal.addEventListener('shown.bs.modal', () => {
            const widgetInput = autocompleteWidget.querySelector('input');
            if (widgetInput) {
                widgetInput.focus();
            }
        }, { once: true });
    }

    // Handle selection from popup
    handlePopupSelection(placeData, addressFieldId, modalId) {
        console.log('🎬 Processing popup selection...');
        
        // Extract street address
        const streetAddress = this.extractStreetAddressFromNewPlace(placeData);
        
        // Update the main form fields
        const addressField = document.getElementById(addressFieldId);
        if (addressField) {
            addressField.value = streetAddress;
            addressField.style.backgroundColor = '#f0f8f0'; // Light green to show it's filled
            console.log('✅ Set street address:', streetAddress);
        }
        
        // Fill other fields
        const cityFieldId = addressFieldId.replace('Address', 'City');
        const stateFieldId = addressFieldId.replace('Address', 'State');  
        const zipFieldId = addressFieldId.replace('Address', 'Zip');
        
        this.fillAddressFieldsFromNewPlace(placeData, addressFieldId, cityFieldId, stateFieldId, zipFieldId);
        
        // Call geocoding API to get/store coordinates
        this.geocodeAddressAsync(placeData.formattedAddress, addressFieldId);
        
        // Close the modal
        const modal = document.getElementById(modalId);
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) {
            bootstrapModal.hide();
        }
        
        console.log('🎯 Popup selection complete - modal closed');
    }

    // Replace widget with regular input field showing street address (legacy)
    replaceWidgetWithInput(widget, originalField, streetAddress) {
        console.log('🔄 Replacing widget with regular input field...');
        
        // Remove the widget
        widget.remove();
        
        // Show and configure the original input field
        originalField.style.display = '';
        originalField.value = streetAddress;
        originalField.placeholder = 'Street address (click to edit)';
        originalField.readOnly = false;
        
        // Add a subtle visual indicator that it can be edited
        originalField.style.backgroundColor = '#f8f9ff';
        originalField.style.borderColor = '#3B82F6';
        
        console.log('✅ Widget replaced with editable input showing:', streetAddress);
    }

    // Handle place selection from traditional autocomplete (legacy)
    handleTraditionalPlaceSelection(place, addressField, addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        console.log('🎬 Processing traditional place selection...');
        
        // Extract just the street address
        const streetAddress = this.extractStreetAddress(place);
        
        // Update the address field with only street address
        addressField.value = streetAddress;
        console.log('🏠 Set address field to street address only:', streetAddress);
        
        // Fill other fields using existing method
        this.fillAddressFields(place, addressFieldId, cityFieldId, stateFieldId, zipFieldId);
    }

    // Handle place selection from widget (legacy - keep for compatibility)
    handlePlaceSelection(place, addressField, autocompleteWidget, addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        console.log('🎬 Processing place selection...');
        console.log('📍 Place object structure:', place);
        
        // Get the JSON representation for easier access
        const placeData = place.toJSON();
        console.log('📍 Place data:', placeData);
        console.log('📍 Place address components:', placeData.addressComponents);
        
        // Parse the street address only (without city, state, zip, country)
        const streetAddress = this.extractStreetAddressFromNewPlace(placeData);
        
        // Update the hidden original input field
        addressField.value = streetAddress;
        
        // Hide the autocomplete widget and show the original field with just street address
        setTimeout(() => {
            console.log('🔄 Hiding widget and showing original field with street address');
            
            // Hide the autocomplete widget
            autocompleteWidget.style.display = 'none';
            
            // Show and update the original input field
            addressField.style.display = '';
            addressField.value = streetAddress;
            addressField.readonly = false; // Allow manual editing
            
            console.log('✅ Switched to manual input with street address:', streetAddress);
        }, 100);
        
        console.log('🏠 Set address field to street address only:', streetAddress);
        
        this.fillAddressFieldsFromNewPlace(placeData, addressFieldId, cityFieldId, stateFieldId, zipFieldId);
    }

    // Extract street address from new Place object format
    extractStreetAddressFromNewPlace(placeData) {
        let streetNumber = '';
        let streetName = '';
        
        if (placeData.addressComponents) {
            placeData.addressComponents.forEach(component => {
                const types = component.types;
                
                if (types.includes('street_number')) {
                    streetNumber = component.longText;
                } else if (types.includes('route')) {
                    streetName = component.longText;
                }
            });
        }
        
        // Combine street number and name
        const streetAddress = [streetNumber, streetName].filter(part => part).join(' ');
        
        // If no street components found, try to extract from formatted address
        if (!streetAddress && placeData.formattedAddress) {
            // Split the formatted address and take the first part (before first comma)
            const parts = placeData.formattedAddress.split(',');
            return parts[0].trim();
        }
        
        console.log('🏠 Extracted street address from new format:', { streetNumber, streetName, result: streetAddress });
        return streetAddress;
    }

    // Fill address fields from new Place object format
    fillAddressFieldsFromNewPlace(placeData, addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        console.log('🔧 Starting to fill address fields from new place format...');
        console.log('🎯 Target field IDs:', { cityFieldId, stateFieldId, zipFieldId });
        
        const cityField = cityFieldId ? document.getElementById(cityFieldId) : null;
        const stateField = stateFieldId ? document.getElementById(stateFieldId) : null;
        const zipField = zipFieldId ? document.getElementById(zipFieldId) : null;

        console.log('🎛️ Found field elements:', { 
            cityField: !!cityField, 
            stateField: !!stateField, 
            zipField: !!zipField 
        });

        // Parse address components from new place object
        let city = '';
        let state = '';
        let zipCode = '';

        if (placeData.addressComponents) {
            console.log('📋 Processing address components from new format...');
            placeData.addressComponents.forEach((component, index) => {
                const types = component.types;
                console.log(`📋 Component ${index}:`, { types, longText: component.longText, shortText: component.shortText });
                
                if (types.includes('locality')) {
                    city = component.longText;
                    console.log('🏙️ Found city:', city);
                } else if (types.includes('administrative_area_level_1')) {
                    state = component.shortText; // Use short name for state (e.g., CA instead of California)
                    console.log('🗺️ Found state:', state);
                } else if (types.includes('postal_code')) {
                    zipCode = component.longText;
                    console.log('📮 Found zip:', zipCode);
                }
            });
        } else {
            console.warn('⚠️ No address components found in new place object');
        }

        // Fill fields
        if (cityField && city) {
            cityField.value = city;
            console.log('✅ Set city field to:', city);
        } else {
            console.log('❌ Could not set city:', { cityField: !!cityField, city });
        }

        if (stateField && state) {
            stateField.value = state;
            console.log('✅ Set state field to:', state);
        } else {
            console.log('❌ Could not set state:', { stateField: !!stateField, state });
        }

        if (zipField && zipCode) {
            zipField.value = zipCode;
            console.log('✅ Set zip field to:', zipCode);
        } else {
            console.log('❌ Could not set zip:', { zipField: !!zipField, zipCode });
        }

        // Log the final result
        console.log('🎯 Final parsed address result from new format:', {
            formattedAddress: placeData.formattedAddress,
            city,
            state,
            zipCode,
            displayName: placeData.displayName
        });
    }

    // Extract just the street address from place object (legacy format)
    extractStreetAddress(place) {
        let streetNumber = '';
        let streetName = '';
        
        if (place.addressComponents) {
            place.addressComponents.forEach(component => {
                const types = component.types;
                
                if (types.includes('street_number')) {
                    streetNumber = component.longText;
                } else if (types.includes('route')) {
                    streetName = component.longText;
                }
            });
        }
        
        // Combine street number and name
        const streetAddress = [streetNumber, streetName].filter(part => part).join(' ');
        
        // If no street components found, try to extract from formatted address
        if (!streetAddress && place.formattedAddress) {
            // Split the formatted address and take the first part (before first comma)
            const parts = place.formattedAddress.split(',');
            return parts[0].trim();
        }
        
        console.log('🏠 Extracted street address:', { streetNumber, streetName, result: streetAddress });
        return streetAddress;
    }

    // Fill address fields based on selected place (new widget format)
    fillAddressFieldsFromPlace(place, addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        console.log('🔧 Starting to fill address fields...');
        console.log('🎯 Target field IDs:', { cityFieldId, stateFieldId, zipFieldId });
        
        const cityField = cityFieldId ? document.getElementById(cityFieldId) : null;
        const stateField = stateFieldId ? document.getElementById(stateFieldId) : null;
        const zipField = zipFieldId ? document.getElementById(zipFieldId) : null;

        console.log('🎛️ Found field elements:', { 
            cityField: !!cityField, 
            stateField: !!stateField, 
            zipField: !!zipField 
        });

        // Parse address components from new place object
        let city = '';
        let state = '';
        let zipCode = '';

        if (place.addressComponents) {
            console.log('📋 Processing address components...');
            place.addressComponents.forEach((component, index) => {
                const types = component.types;
                console.log(`📋 Component ${index}:`, { types, longText: component.longText, shortText: component.shortText });
                
                if (types.includes('locality')) {
                    city = component.longText;
                    console.log('🏙️ Found city:', city);
                } else if (types.includes('administrative_area_level_1')) {
                    state = component.shortText; // Use short name for state (e.g., CA instead of California)
                    console.log('🗺️ Found state:', state);
                } else if (types.includes('postal_code')) {
                    zipCode = component.longText;
                    console.log('📮 Found zip:', zipCode);
                }
            });
        } else {
            console.warn('⚠️ No address components found in place object');
        }

        // Fill fields
        if (cityField && city) {
            cityField.value = city;
            console.log('✅ Set city field to:', city);
        } else {
            console.log('❌ Could not set city:', { cityField: !!cityField, city });
        }

        if (stateField && state) {
            stateField.value = state;
            console.log('✅ Set state field to:', state);
        } else {
            console.log('❌ Could not set state:', { stateField: !!stateField, state });
        }

        if (zipField && zipCode) {
            zipField.value = zipCode;
            console.log('✅ Set zip field to:', zipCode);
        } else {
            console.log('❌ Could not set zip:', { zipField: !!zipField, zipCode });
        }

        // Log the final result
        console.log('🎯 Final parsed address result:', {
            formattedAddress: place.formattedAddress,
            city,
            state,
            zipCode,
            displayName: place.displayName
        });
    }

    // Fill address fields based on selected place (legacy format - keep for compatibility)
    fillAddressFields(place, addressFieldId, cityFieldId, stateFieldId, zipFieldId) {
        const addressField = document.getElementById(addressFieldId);
        const cityField = cityFieldId ? document.getElementById(cityFieldId) : null;
        const stateField = stateFieldId ? document.getElementById(stateFieldId) : null;
        const zipField = zipFieldId ? document.getElementById(zipFieldId) : null;

        // Parse address components
        let streetNumber = '';
        let streetName = '';
        let city = '';
        let state = '';
        let zipCode = '';
        let country = '';

        place.address_components.forEach(component => {
            const types = component.types;
            
            if (types.includes('street_number')) {
                streetNumber = component.long_name;
            } else if (types.includes('route')) {
                streetName = component.long_name;
            } else if (types.includes('locality')) {
                city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
                state = component.short_name; // Use short name for state (e.g., CA instead of California)
            } else if (types.includes('postal_code')) {
                zipCode = component.long_name;
            } else if (types.includes('country')) {
                country = component.short_name;
            }
        });

        // Build full street address
        const streetAddress = [streetNumber, streetName].filter(part => part).join(' ');

        // Fill fields
        if (addressField) {
            // For healthcare facilities, prefer the place name if it's a business
            if (place.name && place.types && place.types.includes('hospital')) {
                addressField.value = `${place.name}\n${streetAddress}`;
            } else {
                addressField.value = streetAddress || place.formatted_address;
            }
        }

        if (cityField && city) {
            cityField.value = city;
        }

        if (stateField && state) {
            stateField.value = state;
        }

        if (zipField && zipCode) {
            zipField.value = zipCode;
        }

        // Log the parsed address for debugging
        console.log('Parsed address:', {
            streetAddress,
            city,
            state,
            zipCode,
            country,
            placeName: place.name,
            placeTypes: place.types
        });
    }

    // Remove autocomplete from a field
    removeAutocomplete(addressFieldId) {
        const autocompleteElement = this.autocompleteInstances.get(addressFieldId);
        if (autocompleteElement) {
            // For search icon approach
            if (autocompleteElement.searchButton && autocompleteElement.inputContainer) {
                // Smart cleanup: extract the address field before removing container
                const addressField = document.getElementById(addressFieldId);
                const container = autocompleteElement.inputContainer;
                
                if (addressField && container && container.parentNode) {
                    // Move the address field back to where the container was
                    container.parentNode.insertBefore(addressField, container);
                    console.log(`📤 Moved address field back out of container for ${addressFieldId}`);
                }
                
                // Now safe to remove the container (which no longer contains the address field)
                container.remove();
                
                // Remove the modal as well
                const modalId = `addressSearchModal_${addressFieldId}`;
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.remove();
                }
                
                console.log(`✅ Smart cleanup completed for ${addressFieldId}`);
            } 
            // For widget approach
            else if (autocompleteElement.tagName === 'GMP-PLACE-AUTOCOMPLETE') {
                autocompleteElement.remove();
                // Show the original input field again
                const originalField = document.getElementById(addressFieldId);
                if (originalField) {
                    originalField.style.display = '';
                }
            } 
            // For legacy approach
            else {
                google.maps.event.clearInstanceListeners(autocompleteElement);
            }
            this.autocompleteInstances.delete(addressFieldId);
            console.log(`Autocomplete removed for ${addressFieldId}`);
        }
    }

    // Clean up all autocomplete instances
    cleanup() {
        this.autocompleteInstances.forEach((autocomplete, fieldId) => {
            this.removeAutocomplete(fieldId);
        });
        this.autocompleteInstances.clear();
    }

    // Check if autocomplete is available
    isAvailable() {
        return this.isLoaded && window.google && window.google.maps && window.google.maps.places;
    }

    // Get autocomplete suggestions programmatically (if needed)
    async getPlacePredictions(input, options = {}) {
        if (!this.isAvailable()) {
            return [];
        }

        const service = new google.maps.places.AutocompleteService();
        const defaultOptions = {
            types: ['establishment', 'geocode'],
            componentRestrictions: { country: 'us' }, // Restrict to US for healthcare facilities
            ...options
        };

        return new Promise((resolve, reject) => {
            service.getPlacePredictions({
                input,
                ...defaultOptions
            }, (predictions, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(predictions || []);
                } else {
                    console.warn('Places predictions failed:', status);
                    resolve([]);
                }
            });
        });
    }

    // Call the geocoding API to get coordinates for an address
    async geocodeAddressAsync(address, fieldId) {
        try {
            console.log(`🌍 Calling geocoding API for address: "${address}"`);
            
            // Use relative URL for geocoding API (auto-detects base URL)
            const apiUrl = '/api/geocoding-simple/address';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: address
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                const { latitude, longitude, formattedAddress } = result.data;
                
                console.log(`✅ Geocoding successful: ${latitude}, ${longitude}`);
                console.log(`📍 Formatted address: ${formattedAddress}`);
                
                // Store coordinates in hidden fields (if they exist)
                this.storeCoordinates(fieldId, latitude, longitude);
                
                // Dispatch custom event with geocoding results
                const geocodingEvent = new CustomEvent('addressGeocoded', {
                    detail: {
                        fieldId: fieldId,
                        originalAddress: address,
                        formattedAddress: formattedAddress,
                        latitude: latitude,
                        longitude: longitude,
                        timestamp: new Date().toISOString()
                    }
                });
                
                document.dispatchEvent(geocodingEvent);
                console.log('📡 Dispatched addressGeocoded event');

            } else {
                console.warn('❌ Geocoding failed:', result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('🚨 Geocoding API error:', error);
        }
    }

    // Store coordinates in hidden latitude/longitude fields
    storeCoordinates(addressFieldId, latitude, longitude) {
        // Try to find corresponding latitude and longitude fields
        const latitudeFieldId = addressFieldId.replace('Address', 'Latitude');
        const longitudeFieldId = addressFieldId.replace('Address', 'Longitude');
        
        const latitudeField = document.getElementById(latitudeFieldId);
        const longitudeField = document.getElementById(longitudeFieldId);
        
        if (latitudeField) {
            latitudeField.value = latitude;
            console.log(`📍 Stored latitude: ${latitude} in field ${latitudeFieldId}`);
        } else {
            console.log(`⚠️ Latitude field not found: ${latitudeFieldId}`);
        }
        
        if (longitudeField) {
            longitudeField.value = longitude;
            console.log(`📍 Stored longitude: ${longitude} in field ${longitudeFieldId}`);
        } else {
            console.log(`⚠️ Longitude field not found: ${longitudeFieldId}`);
        }
    }
}

// Create singleton instance
export const googlePlacesAutocomplete = new GooglePlacesAutocomplete();