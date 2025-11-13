// Wikidata API integration
class WikidataAPI {
    constructor() {
        this.endpoint = 'https://www.wikidata.org/wiki/Special:EntityData/';
        this.sparqlEndpoint = 'https://query.wikidata.org/sparql';
    }

    // Get entity data by ID
    async getEntity(entityId) {
        try {
            const response = await fetch(`${this.endpoint}${entityId}.json`);
            const data = await response.json();
            return data.entities[entityId];
        } catch (error) {
            console.error('Error fetching Wikidata entity:', error);
            return null;
        }
    }

    // Search for entities
    async searchEntities(searchTerm, language = 'it') {
        try {
            const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=${language}&format=json&origin=*`;
            const response = await fetch(url);
            const data = await response.json();
            return data.search;
        } catch (error) {
            console.error('Error searching Wikidata:', error);
            return [];
        }
    }

    // Get label for entity
    getLabel(entity, language = 'it') {
        if (entity.labels && entity.labels[language]) {
            return entity.labels[language].value;
        }
        return 'Informazione non disponibile';
    }

    // Get description for entity
    getDescription(entity, language = 'it') {
        if (entity.descriptions && entity.descriptions[language]) {
            return entity.descriptions[language].value;
        }
        return 'Descrizione non disponibile';
    }

    // Get property value
    getPropertyValue(entity, propertyId, language = 'it') {
        if (entity.claims && entity.claims[propertyId]) {
            const claim = entity.claims[propertyId][0];
            if (claim.mainsnak.datavalue) {
                const value = claim.mainsnak.datavalue.value;

                if (value.id) {
                    // It's another entity
                    return this.getEntityLabelById(value.id, language);
                } else if (typeof value === 'string') {
                    return value;
                } else if (value.text) {
                    return value.text;
                } else if (value.amount) {
                    return value.amount;
                } else if (value.time) {
                    return value.time;
                }
            }
        }
        return 'Non specificato';
    }

    // Get entity label by ID (simplified)
    async getEntityLabelById(entityId, language = 'it') {
        try {
            const entity = await this.getEntity(entityId);
            return this.getLabel(entity, language);
        } catch (error) {
            return entityId;
        }
    }

    // Format date from Wikidata
    formatWikidataDate(dateString) {
        if (!dateString) return 'Data non disponibile';

        // Wikidata dates are in format +1962-00-00T00:00:00Z
        const match = dateString.match(/\+(\d{4})-\d{2}-\d{2}/);
        if (match) {
            return match[1];
        }
        return dateString;
    }
}

// Main application
class ProjectDetailApp {
    constructor() {
        this.wikidata = new WikidataAPI();
        this.urlParams = new URLSearchParams(window.location.search);
        this.artistName = this.urlParams.get('artist') || 'Giuseppe Penone';
        this.workName = this.urlParams.get('work') || 'Albero della Vita';
        this.year = this.urlParams.get('year') || '1962';
    }

    async init() {
        this.showLoading();

        try {
            // Update page title and basic info
            document.getElementById('projectTitle').textContent = this.workName;
            document.getElementById('projectArtist').textContent = this.artistName;
            document.getElementById('projectYear').textContent = this.year;
            document.title = `${this.workName} - ${this.artistName} | Biennale Eco Archive`;

            // Search for artist and work on Wikidata
            await this.loadArtistData();
            await this.loadWorkData();

            this.hideLoading();
            this.showContent();
        } catch (error) {
            console.error('Error initializing app:', error);
            this.hideLoading();
            this.showContent();
            this.showError();
        }
    }

    async loadArtistData() {
        const artistResults = await this.wikidata.searchEntities(this.artistName);

        if (artistResults.length > 0) {
            const artistEntity = await this.wikidata.getEntity(artistResults[0].id);
            this.displayArtistData(artistEntity);
        } else {
            this.displayNoArtistData();
        }
    }

    async loadWorkData() {
        const workResults = await this.wikidata.searchEntities(`${this.workName} ${this.artistName}`);

        if (workResults.length > 0) {
            const workEntity = await this.wikidata.getEntity(workResults[0].id);
            this.displayWorkData(workEntity);

            // Enable Wikidata link
            const wikidataLink = document.getElementById('viewOnWikidata');
            wikidataLink.href = `https://www.wikidata.org/wiki/${workResults[0].id}`;
            wikidataLink.disabled = false;
        } else {
            this.displayNoWorkData();
        }
    }

    async displayArtistData(artist) {
        const container = document.getElementById('artistWikidata');

        const data = {
            'Nome': await this.wikidata.getLabel(artist),
            'Descrizione': await this.wikidata.getDescription(artist),
            'Data di nascita': await this.wikidata.formatWikidataDate(this.wikidata.getPropertyValue(artist, 'P569')),
            'Luogo di nascita': await this.wikidata.getPropertyValue(artist, 'P19'),
            'Nazionalità': await this.wikidata.getPropertyValue(artist, 'P27'),
            'Movimento artistico': await this.wikidata.getPropertyValue(artist, 'P135')
        };

        this.renderMetadata(container, data);
    }

    async displayWorkData(work) {
        const container = document.getElementById('workWikidata');

        const data = {
            'Titolo': await this.wikidata.getLabel(work),
            'Descrizione': await this.wikidata.getDescription(work),
            'Data di creazione': await this.wikidata.formatWikidataDate(this.wikidata.getPropertyValue(work, 'P571')),
            'Tecnica': await this.wikidata.getPropertyValue(work, 'P186'),
            'Materiale': await this.wikidata.getPropertyValue(work, 'P186'),
            'Dimensioni': await this.wikidata.getPropertyValue(work, 'P2049'),
            'Genere': await this.wikidata.getPropertyValue(work, 'P136')
        };

        this.renderMetadata(container, data);
    }

    renderMetadata(container, data) {
        let html = '';

        Object.entries(data).forEach(([key, value]) => {
            html += `
                <div class="wikidata-item">
                    <div class="metadata-label">${key}:</div>
                    <div class="metadata-value">${value}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    displayNoArtistData() {
        document.getElementById('artistWikidata').innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Nessun dato trovato su Wikidata per l'artista "${this.artistName}".
            </div>
        `;
    }

    displayNoWorkData() {
        document.getElementById('workWikidata').innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Nessun dato trovato su Wikidata per l'opera "${this.workName}".
            </div>
        `;
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('projectContent').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showContent() {
        document.getElementById('projectContent').style.display = 'block';
    }

    showError() {
        const container = document.getElementById('projectContent');
        container.innerHTML = `
            <div class="alert alert-danger">
                <h4>Errore nel caricamento dei dati</h4>
                <p>Si è verificato un errore durante il caricamento delle informazioni da Wikidata.</p>
                <a href="edition-1962.html" class="btn btn-primary">Torna all'edizione 1962</a>
            </div>
        `;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const app = new ProjectDetailApp();
    app.init();
});