// Ensure Lampa settings are modified before initialization
window.lampa_settings = window.lampa_settings || {};
window.lampa_settings.push_state = false;

// Set CUB domain and mirror settings in localStorage
localStorage.setItem('cub_domain', 'cubs.hoprop.xyz');
localStorage.setItem('cub_mirrors', JSON.stringify(["cub.rip", "lampadev.ru"]));
