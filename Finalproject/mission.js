const missionParameters = new URLSearchParams(window.location.search); // Mission page - read the values sent from Home in the URL. Read the query string after the question mark in this page address.
// Get the planet name and minutes that Home sent when Launch Mission was clicked.
const planetName = missionParameters.get('planet');
const minutesText = missionParameters.get('minutes');
const studyMinutes = Number(minutesText); // Convert the minutes from text to a number so we can calculate the timer lengths.

const destination = planets.find(planet => planet.name === planetName); // Check the values because someone can edit the URL or visit directly. Find the matching planet object so we can use its NASA image ID.
const validDuration = /^\d{1,3}$/.test(minutesText || '') && studyMinutes >= 31 && studyMinutes <= 180; // Require 1 to 3 digits and a value from 31 to 180. Reject missing or edited invalid values.

// Only show the mission if both values are valid. Otherwise the Home link stays visible.
if (destination && validDuration) {
    // Fill in the planet name, hide the choose-a-destination message, and show the mission.
    document.getElementById('destination-name').textContent = planetName;
    document.getElementById('no-mission').hidden = true;
    document.getElementById('mission-details').hidden = false;

    document.getElementById('mission-nav-link').href = 'mission.html?' + missionParameters.toString(); // Keep the selection when clicking the current page's navigation link.


    // Find the planet image, its loading message, and the NASA credit in the HTML.
    const planetImage = document.getElementById('mission-planet-image');
    const imageStatus = document.getElementById('planet-image-status');
    const imageCredit = document.getElementById('planet-image-credit');

    // Use the selected planet’s NASA ID to find and load its image.
    async function loadDestinationImage() {
        try {
            const result = await getNasaData('https://images-api.nasa.gov/asset/' + destination.nasaId); // Wait for the NASA asset endpoint to return the selected image file links.
            const images = result.collection.items.filter(item => isImageUrl(item.href)); // Keep only NASA image file links from the response.
            const image = images.find(item => item.href.includes('~medium')) || images[0]; // Choose a medium-sized image, falling back to the first usable file.
            if (!image) throw new Error('NASA returned no image for this destination.'); // Jump to catch if NASA returned no usable image.

            // Show the image and credit once the browser has loaded the file.
            planetImage.addEventListener('load', () => {
                planetImage.hidden = false;
                imageCredit.hidden = false;
                imageStatus.hidden = true;
            }, { once: true }); // Remove this load listener after it has run once.
            planetImage.addEventListener('error', showImageError, { once: true }); // Show the fallback message if the image file itself fails to download.
            // Give the planet image alternative text, then start downloading its HTTPS image.
            planetImage.alt = 'NASA image of ' + planetName;
            planetImage.src = secureImageUrl(image.href);
        // Also show the fallback if the API request or image lookup fails.
        } catch {
            showImageError();
        }
    }

    // Tell the user the image failed while allowing the timer to run.
    function showImageError() {
        imageStatus.textContent = 'NASA image unavailable.';
    }

    loadDestinationImage(); // Run the image-loading function. The timer can be used while NASA is loading.

    // Find the two clocks, the phase label, and the timer controls.
    const countdown = document.getElementById('mission-countdown');
    const totalCountdown = document.getElementById('total-countdown');
    const phaseLabel = document.getElementById('timer-phase');
    const status = document.getElementById('timer-status');
    const startButton = document.getElementById('timer-start');
    const minute = 60 * 1000; // One minute is 60 seconds times 1000 milliseconds. Timer calculations use milliseconds.
    const phases = []; // Start an empty list that will hold each focus block and each break in order.

    // Put a break between focus blocks and use any leftover minutes in the last block.
    // All uses of 25 in this loop control the focus block length. Keep them in sync if changing it.
    for (let minutesLeft = studyMinutes; minutesLeft > 0; minutesLeft -= 25) {
        phases.push({ label: 'Focus', duration: Math.min(minutesLeft, 25) * minute }); // Add a focus block of 25 minutes, or the remaining focus minutes if fewer than 25 are left.
        if (minutesLeft > 25) phases.push({ label: 'Break', duration: 5 * minute }); // The 5 is the break length in minutes. Add a break only if more focus time remains.
    }

    // Track the current block, time remaining, and completed focus time.
    let phaseIndex = 0; // Start at the first block in the list. Array positions start at zero.
    let remainingTime = phases[0].duration; // Start the current countdown at the length of that first focus block.
    let completedFocusTime = 0; // Track finished focus blocks here. Break time is never added to this total.
    let endTime; // This will hold the time when the running block should finish.
    let intervalId = null; // Keep the repeated update ID so it can be stopped when the mission finishes.

    // Convert milliseconds to minutes and seconds, such as 05:00.
    function formatTime(time) {
        const secondsLeft = Math.ceil(time / 1000); // Round up to the next whole second so the clock only shows zero when time has finished.
        const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0'); // Divide by 60 to get whole minutes, then add a leading zero for single-digit values.
        const seconds = String(secondsLeft % 60).padStart(2, '0'); // The remainder after dividing by 60 gives seconds. Add a leading zero if needed.
        return minutes + ':' + seconds; // Join the two text values into the minutes:seconds display.
    }

    // Update both clocks and scale the planet using completed focus time.
    function showTime() {
        countdown.textContent = formatTime(remainingTime); // Put the time remaining in the current focus or break block on the main clock.

        // Count elapsed time in this block only if it is a focus block.
        const phase = phases[phaseIndex];
        const currentFocusTime = phase.label === 'Focus' ? phase.duration - remainingTime : 0; // During focus, subtract time left from the block length. During a break, use zero.
        const focusTime = completedFocusTime + currentFocusTime; // Add the focus time spent in this block to the focus blocks already finished.
        const totalDuration = studyMinutes * minute; // Convert all the selected focus minutes into milliseconds.
        totalCountdown.textContent = formatTime(totalDuration - focusTime); // Subtract elapsed focus time from the full duration to update the second clock.
        const progress = focusTime / totalDuration; // Divide completed focus time by total focus time to get progress from zero to one.
        planetImage.style.transform = 'scale(' + (0.42 + 0.58 * progress) + ')'; // Grow the planet from 42% to full size as the user finishes their focus time. 0.42 is the starting scale. Adding 0.58 as progress reaches 1 brings the image to full size.
    }

    // Stop the repeated timer updates and mark the clock as stopped.
    function stopUpdates() {
        // Stop the automatic updates and clear the saved ID when the mission finishes.
        clearInterval(intervalId);
        intervalId = null;
    }

    // Show whether the current block is Focus or Break.
// Show a break reminder and clear it during focus.
    function showRunningStatus() {
        const label = phases[phaseIndex].label;
        phaseLabel.textContent = label; // Display the current block label above the countdown.
        status.textContent = label === 'Focus' ? '' : 'Take a 5-minute break.'; // Keep this status empty during focus and show the break reminder during a break.
    }

    // Use phase deadlines so delayed browser updates keep the schedule accurate.
    function updateTimer() {
        const now = Date.now(); // Read the current time in milliseconds so we can compare it with the block deadline.
        // Advance through any finished blocks and add their focus time to the total.
        while (now >= endTime && phaseIndex < phases.length - 1) {
            // Add a finished focus block to the study total. Finished breaks do not count as studying.
            if (phases[phaseIndex].label === 'Focus') {
                completedFocusTime += phases[phaseIndex].duration;
            }
            phaseIndex++; // Move to the next focus or break block in the list.
            endTime += phases[phaseIndex].duration; // Add the next block length to the old deadline, so delayed updates do not extend the session.
            showRunningStatus();
        }

        // Calculate the time left and stop it going below zero, then update the clocks and planet.
        remainingTime = Math.max(0, endTime - now);
        showTime();

        // End the mission when the final block reaches zero.
        if (remainingTime === 0) {
            stopUpdates();
            // Show arrival when the last focus block finishes.
            phaseLabel.textContent = 'Arrived';
            startButton.textContent = 'Complete';
            status.textContent = 'Mission complete! You arrived at ' + planetName + '.';
        }
    }

    // Start the mission once and continue automatically through focus blocks and breaks.
    startButton.addEventListener('click', () => {
        if (startButton.disabled) return; // Prevent starting a second timer after the mission has begun.
        startButton.disabled = true; // Keep the user from starting or pausing the running mission.
        startButton.textContent = 'Started';
        endTime = Date.now() + remainingTime; // Set the deadline for the first focus block.
        intervalId = setInterval(updateTimer, 250); // Refresh the clocks every quarter of a second.
        showRunningStatus();
    });

    showTime(); // Draw the clocks and starting planet size when the page first opens.
}