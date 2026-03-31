import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import searchVenues       from '@salesforce/apex/VenueSearchController.searchVenues';
import getVenueDetails    from '@salesforce/apex/VenueSearchController.getVenueDetails';
import saveVenueAddress   from '@salesforce/apex/VenueSearchController.saveVenueAddress';
import getDistanceToVenue from '@salesforce/apex/VenueSearchController.getDistanceToVenue';
import clearVenue         from '@salesforce/apex/VenueSearchController.clearVenue';

// Only simple text fields via wire — compound address sub-fields read via Apex loadPlaceDetails
const FIELDS = [
    'Opportunity.Venue_WebtoLead_Form__c',
    'Opportunity.Venue_Place_Id__c'
];

const PLACE_TYPE_LABELS = {
    lodging           : 'Hotel',
    event_venue       : 'Event Venue',
    banquet_hall      : 'Banquet Hall',
    restaurant        : 'Restaurant',
    park              : 'Park',
    stadium           : 'Stadium',
    gym               : 'Gym',
    church            : 'Church',
    country_club      : 'Country Club',
    convention_center : 'Convention Center',
    wedding_venue     : 'Wedding Venue',
    tourist_attraction: 'Attraction',
    night_club        : 'Night Club',
    bar               : 'Bar',
    museum            : 'Museum',
    zoo               : 'Zoo',
    amusement_park    : 'Amusement Park',
    art_gallery       : 'Art Gallery',
    premise           : 'Private Venue'
};

export default class VenueSearch extends LightningElement {
    @api recordId;
    @track statusMessage   = '';
    @track errorMessage    = '';
    @track isGeocoding     = false;
    @track isSaving        = false;
    @track streetViewUrl   = null;
    @track venuePlaceName  = '';
    @track venueMeta       = '';
    @track suggestions     = [];
    @track distanceText    = '';

    venueData      = {};
    webFormVenue   = '';
    placeId        = null;
    _venueLat      = null;
    _venueLng      = null;
    _debounceTimer = null;

    // ── Wire: Opportunity ──
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredRecord({ data, error }) {
        if (data) {
            this.webFormVenue = data.fields.Venue_WebtoLead_Form__c?.value || '';

            const savedPlaceId = data.fields.Venue_Place_Id__c?.value;
            if (savedPlaceId && savedPlaceId !== this.placeId) {
                this.placeId = savedPlaceId;
                this.loadPlaceDetails(savedPlaceId);  // populates venueData + photos
            }
        } else if (error) {
            console.error('venueSearch wire error', JSON.stringify(error));
        }
    }

    // ── Computed getters ──
    get hasVenue()              { return !!(this.venueData.street || this.venueData.city); }
    get hasStreetView()         { return !!this.streetViewUrl; }
    get hasSuggestions()        { return this.suggestions.length > 0; }
    get showWebFormSuggestion() { return !!this.webFormVenue && !this.hasVenue; }
    get inputPlaceholder()      { return this.hasVenue ? 'Search to update venue...' : 'Search for a venue or address...'; }
    get showVenueName() {
        if (!this.venuePlaceName) return false;
        const street = (this.venueData.street || '').toLowerCase();
        return !street || !street.startsWith(this.venuePlaceName.toLowerCase().substring(0, 6));
    }
    get mapsUrl() {
        return this.placeId
            ? `https://www.google.com/maps/search/?api=1&query_place_id=${this.placeId}`
            : null;
    }
    get directionsUrl() {
        return this.placeId
            ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${this.placeId}`
            : null;
    }
    get venueStreet()           { return this.venueData.street; }
    get venueCountry()          { return this.venueData.country; }
    get venueCityStateZip() {
        return [this.venueData.city, this.venueData.state, this.venueData.postal]
            .filter(Boolean).join(', ');
    }

    // ── Autocomplete input ──
    handleInput(event) {
        const query = event.target.value.trim();
        this.errorMessage  = '';
        this.statusMessage = '';

        if (!query || query.length < 3) {
            this.suggestions = [];
            clearTimeout(this._debounceTimer);
            return;
        }

        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this.fetchSuggestions(query);
        }, 300);
    }

    handleBlur() {
        // Delay so mousedown on a suggestion fires first
        setTimeout(() => { this.suggestions = []; }, 200);
    }

    // ── Fetch suggestions via Apex → Google Places Autocomplete API ──
    fetchSuggestions(query) {
        searchVenues({ input: query })
            .then(results => {
                this.suggestions = (results || []).map((s, i) => ({ id: i, ...s }));
            })
            .catch(e => {
                console.error('searchVenues error', e);
                this.suggestions = [];
            });
    }

    // ── User selects a suggestion ──
    selectSuggestion(event) {
        const placeId     = event.currentTarget.dataset.placeId;
        const description = event.currentTarget.dataset.description;
        this.suggestions  = [];

        const input = this.template.querySelector('.venue-autocomplete-input');
        if (input) input.value = description;

        this.isSaving = true;

        getVenueDetails({ placeId })
            .then(detail => {
                if (!detail) throw new Error('No details returned');
                this.venuePlaceName = detail.name || '';
                this.venueData = {
                    street : detail.street     || '',
                    city   : detail.city       || '',
                    state  : detail.state      || '',
                    postal : detail.postalCode || '',
                    country: detail.country    || ''
                };
                this.buildMeta(detail.rating, detail.types);
                this.buildStreetView(detail.lat, detail.lng);

                return saveVenueAddress({
                    opportunityId: this.recordId,
                    street       : detail.street     || '',
                    city         : detail.city        || '',
                    state        : detail.state       || '',
                    postalCode   : detail.postalCode  || '',
                    country      : detail.country     || '',
                    placeId      : placeId
                });
            })
            .then(() => {
                this.placeId   = placeId;
                this.isSaving  = false;
                const input = this.template.querySelector('.venue-autocomplete-input');
                if (input) input.value = '';
                this.statusMessage = 'Venue saved.';
                setTimeout(() => { this.statusMessage = ''; }, 3000);
                this.dispatchEvent(new ShowToastEvent({
                    title  : 'Venue Updated',
                    message: this.venuePlaceName || 'Venue saved successfully',
                    variant: 'success'
                }));
            })
            .catch(e => {
                this.isSaving     = false;
                this.errorMessage = e.body?.message || e.message || 'Could not save venue.';
            });
    }

    // ── Load address + street view for a saved place_id (page load) ──
    loadPlaceDetails(placeId) {
        if (!placeId) return;
        getVenueDetails({ placeId })
            .then(detail => {
                if (detail) {
                    this.venuePlaceName = detail.name || '';
                    this.buildMeta(detail.rating, detail.types);
                    this.buildStreetView(detail.lat, detail.lng);
                    this.venueData = {
                        street : detail.street     || '',
                        city   : detail.city       || '',
                        state  : detail.state      || '',
                        postal : detail.postalCode || '',
                        country: detail.country    || ''
                    };
                }
            })
            .catch(() => {});
    }

    // ── Part 2: geocode web-form text via Google Geocoding API ──
    geocodeWebFormAddress() {
        if (!this.webFormVenue) return;
        this.isGeocoding  = true;
        this.errorMessage = '';

        // Reuse getVenueDetails with a text search by geocoding the address text
        // We pass the raw text as a "search" — use autocomplete first to get placeId
        searchVenues({ input: this.webFormVenue })
            .then(results => {
                if (!results?.length) throw new Error('not_found');
                return getVenueDetails({ placeId: results[0].placeId });
            })
            .then(detail => {
                if (!detail) throw new Error('not_found');
                this.venuePlaceName = detail.name || '';
                this.buildMeta(detail.rating, detail.types);
                this.buildStreetView(detail.lat, detail.lng);

                return saveVenueAddress({
                    opportunityId: this.recordId,
                    street       : detail.street     || '',
                    city         : detail.city        || '',
                    state        : detail.state       || '',
                    postalCode   : detail.postalCode  || '',
                    country      : detail.country     || '',
                    placeId      : detail.placeId || ''
                });
            })
            .then(() => {
                this.isGeocoding   = false;
                this.statusMessage = 'Venue auto-filled from web form address.';
                setTimeout(() => { this.statusMessage = ''; }, 4000);
                this.dispatchEvent(new ShowToastEvent({
                    title  : 'Venue Auto-filled',
                    message: this.venueData.street || this.venueData.city || '',
                    variant: 'success'
                }));
            })
            .catch(e => {
                this.isGeocoding  = false;
                this.errorMessage = e.message === 'not_found'
                    ? 'Could not locate this address. Please search manually.'
                    : (e.body?.message || 'Could not save venue.');
            });
    }

    // ── Build meta line: "⭐ 4.3 · Hotel" ──
    buildMeta(rating, types) {
        const parts = [];
        if (rating != null) parts.push(`⭐ ${Number(rating).toFixed(1)}`);
        if (Array.isArray(types)) {
            const label = types.map(t => PLACE_TYPE_LABELS[t]).find(Boolean);
            if (label) parts.push(label);
        }
        this.venueMeta = parts.join(' · ');
    }

    // ── Build Street View Static API URL from lat/lng ──
    buildStreetView(lat, lng) {
        this._venueLat = lat;
        this._venueLng = lng;
        if (lat == null || lng == null) { this.streetViewUrl = null; return; }
        const KEY = 'AIzaSyAOxiaHz5eFvX56W8dd3UMCxgte9fkJbNo';
        this.streetViewUrl =
            `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${lat},${lng}&fov=80&key=${KEY}`;
        this.fetchDistance(lat, lng);
    }

    // ── Fetch driving distance from org address to venue ──
    fetchDistance(lat, lng) {
        this.distanceText = '';
        getDistanceToVenue({ venueLat: `${lat}`, venueLng: `${lng}` })
            .then(result => { this.distanceText = result || ''; })
            .catch(() => { this.distanceText = ''; });
    }

    // ── Open Google Maps directions in new tab ──
    openDirections() {
        if (this.directionsUrl) window.open(this.directionsUrl, '_blank', 'noopener,noreferrer');
    }

    // ── Clear venue from record and LWC ──
    handleClearVenue() {
        clearVenue({ opportunityId: this.recordId })
            .then(() => {
                this.venueData     = {};
                this.venuePlaceName = '';
                this.venueMeta     = '';
                this.streetViewUrl = null;
                this.distanceText  = '';
                this.placeId       = null;
            })
            .catch(e => {
                this.errorMessage = e.body?.message || 'Could not clear venue.';
            });
    }
}
