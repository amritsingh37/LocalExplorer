// Imports ->
// Material UI Icons:
import SavedSearchIcon from "@mui/icons-material/SavedSearch";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import DarkModeIcon from "@mui/icons-material/DarkMode";


// Leaflet (for maps):
// Leaflet is a popular JavaScript library for interactive maps. leaflet.css is used for styling the maps, while L is the main object used for creating and interacting with maps.

import "leaflet/dist/leaflet.css"
import L from "leaflet";

import "./LocalExplorer.css";
import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_KEY = "49770790-5b41124714a143956ead78304";

const imageCache = {};

const LocalExplorer = () => {
  // This state variable holds the value of the user's input (search query) for places
  const [name, setName] = useState("");
  // This state stores the list of places fetched from the Overpass API
  const [places, setPlaces] = useState([]);
  // Similar to places, but this stores the original list of places fetched. This helps to apply filters without losing the original data.
  const [allPlaces, setAllPlaces] = useState([]);
  // This state holds the selected choice from a dropdown menu
  const [selectChoices, setSelectChoices] = useState("");

  const modeRef = useRef(null);
  const mapRef = useRef(null);
  // This stores the actual Leaflet map instance, allowing interaction with the map (like setting its center, zoom level, and markers).
  const mapInstance = useRef(null);
  const markerLayer = useRef(null);             


  const handleInput = (e) => {
    setName(e.target.value);
  };

  const handleMode = () => {
    if (modeRef.current.classList.contains("dark")) {
      modeRef.current.classList.remove("dark");
      modeRef.current.classList.add("light");
    } else {
      modeRef.current.classList.remove("light");
      modeRef.current.classList.add("dark");
    }
  };

  const handleSearch = async (customLat = null, customLon = null) => {
//     customLat and customLon are optional parameters with default values of null.
//     If you call handleSearch without providing values for customLat and customLon, the function will use the default behavior (getting the current location).
            try {
              let lat, lon;
              if(customLat && customLon){
                lat = customLat;
                lon = customLon;
              }else if(name.trim() != ""){
                const geoResponse = await axios.get(
                  // OpenStreetMap API getting data
                  "https://nominatim.openstreetmap.org/search",
                  {
                    params: {
                      format: "json",
                      q: name,
                    },
                  }
                );

                if (geoResponse.data.length === 0) {
                  alert("Location Not Found");
                  return;
                }

                // If a location is found, get lat and lon

                lat = geoResponse.data[0].lat;
                lon = geoResponse.data[0].lon;

                // If the user doesn't input anything (i.e., name is empty), the function will use the browser's navigator.geolocation.getCurrentPosition method to fetch the user's current latitude and longitude:

              }else{
                try{
              const geoResponse = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  (position) => resolve(position.coords),
                  (error) => reject(error)
                );
              });
              lat = geoResponse.latitude;
              lon = geoResponse.longitude;
            }catch(error){
              console.error("Location error:", error);
              if(error.code === error.PERMISSION_DENIED){
                alert("Location access denied. Please enable location services");
              }else if(error.code === error.POSITION_UNAVAILABLE){
                alert("Location information is unavailable ");
              }else if(error.code === error.TIMEOUT){
                alert("The request  to get user location timed out");
              }else{
                alert("An unknown error occurred while fetchin location");
              }
              return;
            }
          }


            // Formulate Overpass API Query: 
              const radius = 1000;
              const query = `[out:json];
              (
                node["amenity" = "restaurant"](around:${radius},${lat},${lon});
                node["amenity" = "cafe"](around:${radius},${lat},${lon});
                node["amenity" = "university"](around:${radius},${lat},${lon});
                node["amenity" = "school"](around:${radius},${lat},${lon});
                node["amenity" = "metro_station"](around:${radius},${lat},${lon});
                node["amenity" = "hospital"](around:${radius},${lat},${lon});
              );
              out;`;

              // Fetch Data from Overpass API: The query is sent to the Overpass API to retrieve nearby places matching the specified amenities. It uses a POST request with the query:

                const overpassRes = await axios.post(
                  "https://overpass-api.de/api/interpreter",
                  new URLSearchParams({data:query}).toString(),
                  {
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                    }
                  }
                );

                
               const rawPlaces = overpassRes.data.elements;

               const placesWithImage = await Promise.all(
                rawPlaces.map(async (place) => {
                  try{
                  const amenity = place.tags?.amenity || "places";
                  const imageUrl = await handleImage(amenity);

                  const distance = calculateDistance(lat, lon, place.lat, place.lon);
                  const rating = getRandomRating();
                  return {...place, imageUrl, distance, rating};
                }catch(error) {
               console.error("Error fetching data:", place, error);
               return{
                ...place,
                imageUrl:"/no-image.png",
                distance:calculateDistance(lat, lon, place.lat, place.lon),
                rating:getRandomRating(),
            };
            }
          })
        );

        setPlaces(placesWithImage);
        setAllPlaces(placesWithImage);

      }catch(error) {
        console.log("Error in handleSearch:", error);
        alert("Something went  wrong during search");
      }
    };

          const myCurrentLocation = () => {
                  if(!navigator.geolocation){
                    alert("GeoLocation Not Supported");
                    return;
                  }

                 navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const {latitude, longitude} = position.coords;
                    handleSearch(latitude, longitude);
                  },
                  (error) => {
                    console.error("Location error:", error);
                    alert("Failed to get your current location");
                  }
                 )
                };


          const handleImage = async(query) => {
            if(imageCache[query]) return imageCache[query];

            try{
              const response = await axios.get("https://pixabay.com/api/", {
                params : {
                  key:API_KEY,
                  q : query,
                  per_page : 3,
                },
              });

              const hits = response.data?.hits;
              // console.log("Pixabay hits for", query, hits);
              const imageUrl = hits && hits.length > 0? hits[0].webformatURL || hits[0].previewURL : "/no-image.png";
              imageCache[query] = imageUrl;
              return imageUrl;
            }catch(error){
              console.error("Error fetching image:", error);
              return "/no-image.png";
            }
          };

           const selectByChoices = (value) => {
            if(value === "All" || value === ""){
              setPlaces(allPlaces);
            }else{
              const filtered = allPlaces.filter((place) => {
                return (
                  place.tags?.amenity && 
                  place.tags?.amenity.toLowerCase() === value.toLowerCase()
                )
              });
               setPlaces(filtered);
            }
           };

          const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const toRad = (value) => (value * Math.PI)/180;

            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return (R*c).toFixed(2);
          };

          const getRandomRating = () => (Math.random() * 2 + 3).toFixed(1);

          const centreMap = (lat, lon, places) => {
            if(!mapRef.current)
              return;

            if(!mapInstance.current){
              mapInstance.current = L.map(mapRef.current).setView([lat, lon], 13);


              L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                  attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                }).addTo(mapInstance.current);
              }else{
                mapInstance.current.setView([lat, lon], 13);

                if(markerLayer.current){
                  markerLayer.current.clearLayers();
                }
              }

              markerLayer.current = L.layerGroup().addTo(mapInstance.current);

                places.forEach((place) => {
                  const marker = L.marker([place.lat, place.lon]).addTo(mapInstance.current);
                  marker.bindPopup(`<br>${place.tags?.name || place.tags?.amenity}</br> <br>Type:${place.tags?.amenity} <br>Distance:${place.distance}</br> <br>Rating:${place.rating}</br>`);
                  markerLayer.current.addLayer(marker);
                });
          };

          useEffect(() => {
            if(places.length){
              centreMap(places[0].lat, places[0].lon, places)
            }
          }, [places]);
         

  return (
    <>
      <div className="container">
        <div ref={modeRef} className="left-panel">
          <div className="header">
            <h2>Local Explorer</h2>
            <input
              type="text"
              placeholder="Enter nearby place"
              value={name}
              onChange={handleInput}
            />
            <button onClick={handleSearch} className="search">
              <SavedSearchIcon />
            </button>
            <button onClick={myCurrentLocation} className="current-location">
              <AddLocationIcon />
            </button>
            <button className="mode" onClick={handleMode}>
              <DarkModeIcon />
            </button>
          </div>

          <div className="filter-choices">
            <label htmlFor="choices">Choose Explorer</label>
            <select
              name="choices"
              id="choices"
              value={selectChoices}
              onChange={(e) => {
                const selected = e.target.value;
                setSelectChoices(selected);
                selectByChoices(selected);
              }}
            >
              <option>All</option>
              <option value="cafe">Cafe</option>
              <option value="restaurant">Restaurant</option>
              <option value="university">University</option>
              <option value="metro_station">Metro Station</option>
              <option value="hospital">Hospital</option>
              <option value="school">School</option>
            </select>
          </div>

          <div>
            <div className="scroll">
              {places.map((place, index) => (
                <div key={index} className="places-card">
                  <img
                    src={place.imageUrl}
                    alt={place.tags?.name || `Places Image`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/no-image.png";
                    }}
                  />
                  <div className="info">
                    <h4>
                      {place.tags?.name ||
                        place.tags?.amenity ||
                        "Unnamed Place"}
                    </h4>
                    <p className="type">
                      <strong>Type:</strong>
                      {place.tags?.amenity.charAt(0).toUpperCase() +
                        place.tags?.amenity.slice(1)}
                    </p>
                    <p>
                      <strong>Distance : </strong>
                      {place.distance} km away
                    </p>
                    <p>
                      <strong>Rating : ⭐ </strong>
                      {place.rating}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div ref={mapRef} className="right-panel"></div>
      </div>
    </>
  );
};

export default LocalExplorer;