// Application State
let lastValidLocation = "";
let lastCoordinates = null;

// DOM Elements
const searchForm = document.querySelector("#search-form");
const locationInput = document.querySelector("#location-input");
const searchButton = document.querySelector("#search-button");
const refreshButton = document.querySelector("#refresh-button");
const errorMessage = document.querySelector("#error-message");
const loadingIndicator = document.querySelector("#loading-indicator");
const weatherDisplay = document.querySelector("#weather-display");

const currentCityElement = document.querySelector("#current-city");
const currentTimeElement = document.querySelector("#current-time");
const currentIconElement = document.querySelector("#current-icon");
const currentTempElement = document.querySelector("#current-temp");
const currentConditionElement = document.querySelector("#current-condition");
const currentWindElement = document.querySelector("#current-wind");
const currentRainElement = document.querySelector("#current-rain");

const previousHoursContainer = document.querySelector("#previous-hours-container");
const upcomingHoursContainer = document.querySelector("#upcoming-hours-container");

// UI Feedback Functions
const showLoading = () => {
  loadingIndicator.classList.remove("hidden");
  locationInput.disabled = true;
  searchButton.disabled = true;
  refreshButton.disabled = true;
};

const hideLoading = () => {
  loadingIndicator.classList.add("hidden");
  locationInput.disabled = false;
  searchButton.disabled = false;
  refreshButton.disabled = false;
};

const showError = (message) => {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
};

const clearError = () => {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
};

// Strict Location Validation
const validateLocation = (location) => {
  if (!location || location.length === 0) {
    return { isValid: false, errorMessage: "Location field cannot be empty." };
  }

  if (location.trim().length === 0) {
    return { isValid: false, errorMessage: "Location field cannot contain only spaces." };
  }

  if (location.startsWith(" ")) {
    return { isValid: false, errorMessage: "Location cannot have leading spaces." };
  }

  if (location.endsWith(" ")) {
    return { isValid: false, errorMessage: "Location cannot have trailing spaces." };
  }

  if (/\s{2,}/.test(location)) {
    return { isValid: false, errorMessage: "Location cannot contain multiple consecutive spaces." };
  }

  if (/\d/.test(location)) {
    return { isValid: false, errorMessage: "Location cannot contain numbers." };
  }

  const locationPattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
  if (!locationPattern.test(location)) {
    return { isValid: false, errorMessage: "Location must only contain letters and single spaces between words (no special characters)." };
  }

  return { isValid: true, errorMessage: "" };
};

// Open-Meteo Geocoding API
const geocodeLocation = async (location) => {
  const encodedLocation = encodeURIComponent(location);
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedLocation}&count=1&language=en&format=json`;

  const response = await fetch(geocodingUrl);

  if (!response.ok) {
    throw new Error(`Geocoding service returned an error (${response.status}). Please try again later.`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("Location not found. Please check your spelling and try again.");
  }

  const firstResult = data.results[0];
  const addressParts = [firstResult.name, firstResult.admin1, firstResult.country].filter(Boolean);
  const resolvedAddress = addressParts.join(", ");

  return {
    latitude: firstResult.latitude,
    longitude: firstResult.longitude,
    resolvedAddress
  };
};

// Open-Meteo Forecast & Historical Hourly API
const getWeatherData = async (latitude, longitude) => {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&past_days=1&forecast_days=2&timezone=auto`;

  const response = await fetch(forecastUrl);

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("Unable to retrieve weather data for these coordinates.");
    }
    throw new Error(`Weather service returned an error (${response.status}). Please try again later.`);
  }

  const data = await response.json();
  return data;
};

// WMO Weather Interpretation Code Mapping
const getWeatherDetails = (weatherCode) => {
  const code = Number(weatherCode);

  switch (code) {
    case 0:
      return { condition: "Clear Sky", icon: "☀️" };
    case 1:
      return { condition: "Mainly Clear", icon: "🌤️" };
    case 2:
      return { condition: "Partly Cloudy", icon: "⛅" };
    case 3:
      return { condition: "Overcast", icon: "☁️" };
    case 45:
    case 48:
      return { condition: "Foggy", icon: "🌫️" };
    case 51:
    case 53:
    case 55:
      return { condition: "Drizzle", icon: "🌧️" };
    case 56:
    case 57:
      return { condition: "Freezing Drizzle", icon: "🌧️" };
    case 61:
    case 63:
    case 65:
      return { condition: "Rain", icon: "🌧️" };
    case 66:
    case 67:
      return { condition: "Freezing Rain", icon: "🌧️" };
    case 71:
    case 73:
    case 75:
      return { condition: "Snow", icon: "❄️" };
    case 77:
      return { condition: "Snow Grains", icon: "❄️" };
    case 80:
    case 81:
    case 82:
      return { condition: "Rain Showers", icon: "🌧️" };
    case 85:
    case 86:
      return { condition: "Snow Showers", icon: "❄️" };
    case 95:
      return { condition: "Thunderstorm", icon: "⛈️" };
    case 96:
    case 99:
      return { condition: "Thunderstorm with Hail", icon: "⛈️" };
    default:
      return { condition: "Clear", icon: "☀️" };
  }
};

// Date & Time Formatting Helpers
const formatHourTime = (isoTimeString) => {
  if (!isoTimeString) {
    return "--";
  }

  const timeParts = isoTimeString.split("T");
  const timeOnly = timeParts[1] || timeParts[0];
  const hourMinute = timeOnly.split(":");
  const hourNumber = parseInt(hourMinute[0], 10);

  const period = hourNumber >= 12 ? "PM" : "AM";
  const twelveHour = hourNumber % 12 === 0 ? 12 : hourNumber % 12;

  return `${twelveHour} ${period}`;
};

const formatObservationTime = (isoTimeString) => {
  if (!isoTimeString) {
    return "--";
  }

  const parts = isoTimeString.split("T");
  const datePart = parts[0];
  const timeLabel = formatHourTime(isoTimeString);

  return `${datePart} ${timeLabel}`;
};

// Hourly Weather Extraction & Splitting
const extractHourlyWeather = (hourlyData) => {
  if (!hourlyData || !Array.isArray(hourlyData.time)) {
    return [];
  }

  return hourlyData.time.map((timeString, index) => ({
    time: timeString,
    temp: hourlyData.temperature_2m[index],
    windspeed: hourlyData.wind_speed_10m[index],
    precipprob: hourlyData.precipitation_probability ? (hourlyData.precipitation_probability[index] ?? 0) : 0,
    weatherCode: hourlyData.weather_code[index]
  }));
};

const splitHourlyWeather = (allHours, currentTimeString) => {
  if (!allHours || allHours.length === 0) {
    return { previousHours: [], upcomingHours: [], currentHourIndex: -1 };
  }

  // Identify index of the hour matching current time (e.g. "2026-10-28T13")
  const currentPrefix = (currentTimeString || "").slice(0, 13);
  let currentHourIndex = allHours.findIndex((hour) => hour.time.slice(0, 13) === currentPrefix);

  if (currentHourIndex === -1) {
    currentHourIndex = Math.min(36, Math.floor(allHours.length / 2));
  }

  const previousStartIndex = Math.max(0, currentHourIndex - 24);
  const previousHours = allHours.slice(previousStartIndex, currentHourIndex);

  const upcomingEndIndex = Math.min(allHours.length, currentHourIndex + 1 + 24);
  const upcomingHours = allHours.slice(currentHourIndex + 1, upcomingEndIndex);

  return { previousHours, upcomingHours, currentHourIndex };
};

// UI Rendering Functions
const displayCurrentWeather = (currentData, resolvedAddress, rainProbability) => {
  currentCityElement.textContent = resolvedAddress || "--";
  currentTimeElement.textContent = `Observation Time: ${formatObservationTime(currentData.time)}`;

  const temperature = Math.round(currentData.temperature_2m ?? 0);
  currentTempElement.textContent = `${temperature}°C`;

  const { condition, icon } = getWeatherDetails(currentData.weather_code);
  currentConditionElement.textContent = condition;
  currentIconElement.textContent = icon;

  const windSpeed = Math.round(currentData.wind_speed_10m ?? 0);
  currentWindElement.textContent = `${windSpeed} km/h`;

  const safeRainProb = Math.round(rainProbability ?? 0);
  currentRainElement.textContent = `${safeRainProb}%`;

  weatherDisplay.classList.remove("hidden");
};

const createHourlyCard = (hour) => {
  const card = document.createElement("div");
  card.className = "hourly-card";

  const timeLabel = formatHourTime(hour.time);
  const { icon } = getWeatherDetails(hour.weatherCode);
  const temperature = Math.round(hour.temp ?? 0);
  const windSpeed = Math.round(hour.windspeed ?? 0);
  const rainProb = Math.round(hour.precipprob ?? 0);

  card.innerHTML = `
    <span class="hourly-time">${timeLabel}</span>
    <span class="hourly-icon" aria-hidden="true">${icon}</span>
    <span class="hourly-temp">${temperature}°C</span>
    <div class="hourly-meta">
      <span>💨 ${windSpeed} km/h</span>
      <span>🌧️ ${rainProb}%</span>
    </div>
  `;

  return card;
};

const displayHourlyWeather = (previousHours, upcomingHours) => {
  previousHoursContainer.innerHTML = "";
  upcomingHoursContainer.innerHTML = "";

  if (previousHours.length === 0) {
    previousHoursContainer.innerHTML = "<p class='scroll-hint'>No historical hourly observations available.</p>";
  } else {
    previousHours.forEach((hour) => {
      const card = createHourlyCard(hour);
      previousHoursContainer.appendChild(card);
    });
  }

  if (upcomingHours.length === 0) {
    upcomingHoursContainer.innerHTML = "<p class='scroll-hint'>No upcoming hourly forecasts available.</p>";
  } else {
    upcomingHours.forEach((hour) => {
      const card = createHourlyCard(hour);
      upcomingHoursContainer.appendChild(card);
    });
  }
};

// Event Handlers
const handleSearch = async (event) => {
  event.preventDefault();
  clearError();

  const enteredLocation = locationInput.value;
  const validationResult = validateLocation(enteredLocation);

  if (!validationResult.isValid) {
    showError(validationResult.errorMessage);
    return;
  }

  try {
    showLoading();

    const locationInfo = await geocodeLocation(enteredLocation);
    const weatherData = await getWeatherData(locationInfo.latitude, locationInfo.longitude);

    const allHours = extractHourlyWeather(weatherData.hourly);
    const { previousHours, upcomingHours, currentHourIndex } = splitHourlyWeather(allHours, weatherData.current.time);

    const currentRainProb = allHours[currentHourIndex]?.precipprob ?? 0;

    lastValidLocation = enteredLocation;
    lastCoordinates = locationInfo;

    displayCurrentWeather(weatherData.current, locationInfo.resolvedAddress, currentRainProb);
    displayHourlyWeather(previousHours, upcomingHours);
  } catch (error) {
    if (error.name === "TypeError") {
      showError("Network connection error. Please check your internet connection.");
    } else {
      showError(error.message);
    }
  } finally {
    hideLoading();
  }
};

const handleRefresh = async () => {
  clearError();

  if (!lastValidLocation || !lastCoordinates) {
    showError("Please search for a location first before refreshing.");
    return;
  }

  try {
    showLoading();

    const weatherData = await getWeatherData(lastCoordinates.latitude, lastCoordinates.longitude);

    const allHours = extractHourlyWeather(weatherData.hourly);
    const { previousHours, upcomingHours, currentHourIndex } = splitHourlyWeather(allHours, weatherData.current.time);

    const currentRainProb = allHours[currentHourIndex]?.precipprob ?? 0;

    displayCurrentWeather(weatherData.current, lastCoordinates.resolvedAddress, currentRainProb);
    displayHourlyWeather(previousHours, upcomingHours);
  } catch (error) {
    if (error.name === "TypeError") {
      showError("Network connection error. Please check your internet connection.");
    } else {
      showError(error.message);
    }
  } finally {
    hideLoading();
  }
};

// Event Listeners
searchForm.addEventListener("submit", handleSearch);
refreshButton.addEventListener("click", handleRefresh);
