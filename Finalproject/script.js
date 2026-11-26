// Initial setup - find the Home page elements that this script reads and updates
const gallery = document.getElementById('destination-gallery');
const searchInput = document.getElementById('planet-search');
const typeInput = document.getElementById('planet-type');
const galleryStatus = document.getElementById('gallery-status');
const retryButton = document.getElementById('retry-gallery');
const selectedText = document.getElementById('selected-destination');
const assetStatus = document.getElementById('asset-status');
const imageLink = document.getElementById('nasa-image-link');
const missionStatus = document.getElementById('mission-status');

let selectedPlanet = null; //the planet the user has selected for the mission is set to null
let selectionRequest = 0; //to keep the latest selection when NASA replies out of order
let galleryLoading = false; //to not load the gallery more than once at a time

// NASA descriptions sometimes include HTML. Display them as plain text
function plainDescription(description)
{
    //treats the description as HTML and parses it into a document object
    const documentCopy = new DOMParser().parseFromString(description || '', 'text/html');
     //takes the text of the html doctument and replaces whitespace with a single space and trims it and makes it nice
    return documentCopy.body.textContent.replace(/\s+/g, ' ').trim();
}

// Destination cards - use real buttons for mouse, touch, and keyboard selection.
function createPlanetCard(planet) 
{
    const column = document.createElement('div'); // Bootstrap - each planet uses six of the twelve columns.
    column.className = 'col-xs-6 planet-column';

    // Start a new row for positions 0, 2, 4, and 6 so the cards stay in pairs
    if (planets.indexOf(planet) % 2 === 0) column.classList.add('planet-row-start'); 

    const card = document.createElement('button'); //creates the button for the planet card
    card.type = 'button'; //sets the type of the button to button so it doesn't submit a form
    card.className = 'destination-card'; //sets the class of the button to destination-card so it can be styled
    card.setAttribute('aria-pressed', 'false'); //sets the aria-pressed attribute to false
    card.setAttribute('aria-label', 'Select ' + planet.name); //gives screen readers a label such as Select Mars

    // Create the card structure and placeholders. The lines below fill in the name and type, then NASA fills the image and description.
    card.innerHTML = `
        <span class="planet-picture"><span class="image-fallback">Loading NASA image...</span></span>
        <span class="planet-copy">
            <span class="planet-name"></span>
            <span class="planet-type"></span>
            <span class="planet-description">Loading NASA description...</span>
            <span class="planet-credit">NASA Image and Video Library</span>
            <span class="planet-choice">Select destination</span>
        </span>`;

    card.querySelector('.planet-name').textContent = planet.name; //sets the correct name to the correct planet card
    card.querySelector('.planet-type').textContent = planet.type; //sets the correct type to the correct planet card

    card.addEventListener('click', () => selectPlanet(planet)); // Select this planet when the user clicks its card
    planet.card = card; //sets the card property of the planet object to the card element
    planet.column = column; //sets the column property of the planet object to the column element
    column.appendChild(card); //adds the card to the column
    gallery.appendChild(column); //adds the column to the gallery
}

// Endpoint 1 - search for the chosen NASA media item for each planet.
async function loadPlanet(planet)
{
    try //trys and recieves the data from the NASA API
    {
         //creates the url for the NASA API request using the planet's nasaId and specifying that we want images
        const url = 'https://images-api.nasa.gov/search?nasa_id=' + encodeURIComponent(planet.nasaId) + '&media_type=image';
        const result = await getNasaData(url); //waits for the response
        const item = result.collection.items.find(item => item.data && item.data[0].nasa_id === planet.nasaId); //finds the item in the response that matches the planet's nasaId
        if (!item) throw new Error('NASA media was not found.'); //if the item is not found, throw an error(send to catch block)

        const details = item.data[0]; //gets the first item in the data array of the item object
         //finds the first valid image link labeled preview, or searches an empty list if there are no links
        const preview = (item.links || []).find(link => link.rel === 'preview' && isImageUrl(link.href));
        if (!preview) throw new Error('NASA image is unavailable.'); //if the item is not found, throw an error(send to catch block)

        planet.mediaTitle = details.title; //sets the title that nasa sent to the planet object
        const description = plainDescription(details.description); //cleans the NASA description and stores it in this local description variable

        // Captions longer than 190 characters are shortened to 187 characters plus three dots.
        planet.card.querySelector('.planet-description').textContent = description.length > 190 ? description.slice(0, 187) + '...' : description || 'Explore NASA imagery of ' + planet.name + '.'; 
        
        const picture = planet.card.querySelector('.planet-picture'); //gets the picture element of the planet card
        const image = document.createElement('img'); //creates an image element to hold the NASA image
        image.alt = details.title || planet.name; //sets alternative text for screen readers or when the image cannot display
        image.loading = 'lazy';//lets the browser delay loading this image until it is near the visible part of the page

        // Show a fallback message if the image file fails to load.
        image.addEventListener('error', () =>{
            picture.innerHTML = '<span class="image-fallback">NASA image could not load.</span>';
        });

        image.src = secureImageUrl(preview.href); //sets the url of the image to the url that nasa sent and makes it secure
        picture.replaceChildren(image); //replaces the children of the picture element with the image element
        planet.loaded = true; //tells the program that the planet has been loaded successfully
    } catch (error) //if the NASA API request fails, we catch the error and display a message to the user
    {
        planet.loaded = false; //tells the program that the planet has not been loaded successfully
        planet.card.querySelector('.image-fallback').textContent = 'NASA image unavailable'; //sets the text of the image-fallback element to 'NASA image unavailable'
        //sets the text of the planet-description element to 'The NASA request failed. Retry to load this destination’s image and description.'
        planet.card.querySelector('.planet-description').textContent = 'The NASA request failed. Retry to load this destination’s image and description.'; 
        console.error(planet.name, error); //logs the error to the console with the planet's name
    }
}

// Load failed items again without repeating successful API requests.
async function loadGallery()
{
    if (galleryLoading) return; //if the gallery is already loading, we don't want to load it again
    galleryLoading = true; //tells the program that the gallery is loading
    retryButton.hidden = true; //hides the retry button while the gallery is loading
    galleryStatus.textContent = 'Loading NASA images and descriptions...'; //sets the text of the gallery-status element to 'Loading NASA images and descriptions...'
    await Promise.all(planets.filter(planet => !planet.loaded).map(loadPlanet)); //waits for all the planets that have not been loaded to be loaded
    galleryLoading = false; //tells the program that the gallery is no longer loading
    retryButton.hidden = planets.every(planet => planet.loaded); //hides the retry button if all the planets have been loaded
    filterPlanets(); //filters the planets to show only the ones that match the search and type inputs
}

// Search and filter - keep two Bootstrap columns in planet order.
function filterPlanets()
{
    const search = searchInput.value.trim().toLowerCase(); //gets the value of the search input and trims it and makes it lowercase
    let visible = 0; //counts the number of visible planets

    // Show or hide each planet based on the search and type inputs.
    planets.forEach(planet => {
        const matchesName = planet.name.toLowerCase().includes(search); // Check whether the planet name contains what the user typed, ignoring capitals.
        const matchesType = typeInput.value === 'all' || planet.type === typeInput.value; // Allow every type if All is selected, or match the chosen planet type.
        planet.column.hidden = !(matchesName && matchesType); // Hide the whole column if the planet fails either filter.
        planet.column.classList.toggle('planet-row-start', !planet.column.hidden && visible % 2 === 0); // Start a fresh Bootstrap row after each pair of visible planets.
        if (!planet.column.hidden) visible++; // Add one to the count for each card that stays visible.
    });

    // Display the number of visible destinations, and note any NASA media that failed to load.
    if (!galleryLoading){
        const failed = planets.filter(planet => !planet.loaded).length; // Count planets whose NASA data has not loaded successfully.
        galleryStatus.textContent = visible ? visible + ' destinations shown.' : 'No planets match. Try another name or planet type.'; // Show the visible count, or a message if the search has no matches.
        if (failed) galleryStatus.textContent += ' NASA media could not load for ' + failed + ' destinations. You can retry.'; // Add a retry message if any NASA requests failed.
    }
}

// Endpoint 2 - retrieve image-file links for the selected destination.
async function selectPlanet(planet)
{
    selectedPlanet = planet; //sets the planet the user has selected to the planet that was clicked

    const request = ++selectionRequest; // Give this request a number so only the latest selection can update the image link.

    // Update the card states and the selected-destination text.
    planets.forEach(destination => {
        const isSelected = destination === planet; // Compare each planet to the one clicked to decide which card is selected.
        destination.card.setAttribute('aria-pressed', String(isSelected)); // Tell screen readers which card is pressed. CSS also uses this to highlight it.
        destination.card.querySelector('.planet-choice').textContent = isSelected ? 'Selected destination' : 'Select destination'; // Show Selected destination on the chosen card and Select destination on the others.
    });
    
    // Show the new destination and clear the previous message and image link while loading.
    selectedText.textContent = 'Your destination: ' + planet.name;
    missionStatus.textContent = '';
    imageLink.hidden = true;
    imageLink.removeAttribute('href');
    assetStatus.textContent = 'Retrieving the selected NASA image...';
    try {
        const result = await getNasaData('https://images-api.nasa.gov/asset/' + encodeURIComponent(planet.nasaId)); // Ask the asset endpoint for the image file links for the selected NASA ID.
        const files = result.collection.items.filter(item => isImageUrl(item.href)); // Keep the image URLs and leave out metadata or other files from the response.
        const image = files.find(item => item.href.includes('~medium')) || files[0]; // Prefer the medium image. If there is none, use the first image available.
        if (!image) throw new Error('No image files were found.'); // Send execution to catch if NASA returned no usable image file.
        if (request !== selectionRequest) return; // Ignore an older response if the user selects a different planet quickly.
        // Give the link the HTTPS image address, show it, and report that it is ready.
        imageLink.href = secureImageUrl(image.href);
        imageLink.hidden = false;
        assetStatus.textContent = 'NASA image ready for ' + planet.name + '.';
    // Handle a failed asset request and let the user retry by selecting the card again.
    } catch (error) {
        if (request !== selectionRequest) return;
        assetStatus.textContent = 'The full NASA image could not load. Select the card again to retry.';
        console.error(error);
    }
}

// Launch mission - validate the form and pass the selection to page two.
document.getElementById('mission-form').addEventListener('submit', event => {
    event.preventDefault(); // Stop the browser from submitting and reloading the form before our checks run.
// Require a destination before reading the requested study time.
    if (!selectedPlanet) {
        missionStatus.textContent = 'Choose a destination card first.';
        return;
    }
    const minutes = Number(document.getElementById('duration').value); // Read the number input and convert its text value to a number.
    // Keep these limits in sync with the duration input and the check on the Study Mission page.
    if (!Number.isInteger(minutes) || minutes < 31 || minutes > 180) {
        missionStatus.textContent = 'Enter a whole number of minutes between 31 and 180.';
        return;
    }
    // Query parameters carry the destination and minutes in the second page URL.
    const missionParameters = new URLSearchParams();
    // Add the chosen planet and minutes to the query string, then open page two.
    missionParameters.set('planet', selectedPlanet.name);
    missionParameters.set('minutes', minutes);
    window.location.href = 'mission.html?' + missionParameters.toString();
});

// Run the filters when either input changes, and retry NASA requests when asked.
searchInput.addEventListener('input', filterPlanets);
typeInput.addEventListener('change', filterPlanets);
retryButton.addEventListener('click', loadGallery);
// Create the cards first, then load their NASA images and descriptions.
planets.forEach(createPlanetCard);
loadGallery();