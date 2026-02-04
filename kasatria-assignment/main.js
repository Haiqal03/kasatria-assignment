// ===================================
// Configuration
// ===================================
// REPLACE THESE WITH YOUR ACTUAL VALUES
const CONFIG = {
    GOOGLE_CLIENT_ID: '860506498651-p0urjmgod2fjckv656temggujhu598jn.apps.googleusercontent.com',
    GOOGLE_API_KEY: 'AIzaSyC_VZCQfjEo7jbsIka6-C1Oc7u87agzgH4',
    SPREADSHEET_ID: '1-81K9ONn3vtr45BMZwZSYUcjTtSSRTwuUdyjCx5IYS0',
    RANGE: 'Sheet1!A2:F202'
};

// ===================================
// Global Variables
// ===================================
let accessToken = null;
let userData = [];
let scene, camera, renderer, controls;
let objects = [];
let currentView = 'table';

// ===================================
// Google Sign-In Functions
// ===================================

/**
 * Initialize Google Sign-In
 */
function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            use_fedcm_for_prompt: false,  // Disable FedCM to avoid CORS errors
            auto_select: false,
            cancel_on_tap_outside: false
        });

        // Render the Google Sign-In button
        google.accounts.id.renderButton(
            document.getElementById('signInDiv'),
            {
                theme: 'filled_blue',
                size: 'large',
                text: 'signin_with',
                width: 280,
                logo_alignment: 'left'
            }
        );

        console.log('✅ Google Sign-In initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Google Sign-In:', error);
    }
}

/**
 * Handle successful sign-in
 */
function handleCredentialResponse(response) {
    console.log('✅ Sign-in successful!');
    accessToken = response.credential;
    
    try {
        // Decode JWT token to get user info
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const userInfo = JSON.parse(jsonPayload);
        console.log('User info:', userInfo);
        
        // Update UI with user information
        document.getElementById('userPhoto').src = userInfo.picture;
        document.getElementById('userName').textContent = userInfo.name;
        document.getElementById('userInfo').style.display = 'flex';
        
        // Hide login screen and show app
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        // Initialize 3D scene and load data
        init3DScene();
        loadDataFromGoogleSheets();
    } catch (error) {
        console.error('❌ Error processing sign-in:', error);
    }
}

// ===================================
// Sign Out Functionality
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    const signOutBtn = document.getElementById('signOutButton');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function() {
            google.accounts.id.disableAutoSelect();
            location.reload();
        });
    }
});

// ===================================
// Data Loading Functions
// ===================================

/**
 * Load data from Google Sheets
 */
async function loadDataFromGoogleSheets() {
    document.getElementById('loading').style.display = 'block';
    
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.RANGE}?key=${CONFIG.GOOGLE_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from Google Sheets');
        }
        
        const data = await response.json();
        userData = parseSheetData(data.values);
        
        console.log(`✅ Loaded ${userData.length} records`);
        
        createObjects();
        transform(objects, currentView);
        
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('❌ Error loading data:', error);
        document.getElementById('loading').innerHTML = `
            <div class="spinner"></div>
            <p>Error loading data</p>
        `;
    }
}

/**
 * Parse sheet data into structured format
 */
function parseSheetData(rows) {
    return rows.map(row => ({
        name: row[0] || '',
        photo: row[1] || '',
        age: row[2] || '',
        country: row[3] || '',
        interest: row[4] || '',
        netWorth: parseFloat((row[5] || '0').replace(/[$,]/g, ''))
    }));
}

/**
 * Get gradient color based on net worth
 */
function getColorByNetWorth(netWorth) {
    if (netWorth < 100000) return 'linear-gradient(135deg, #ff4444, #cc0000)';
    if (netWorth <= 200000) return 'linear-gradient(135deg, #ff9944, #ff6600)';
    return 'linear-gradient(135deg, #44ff44, #00cc00)';
}

// ===================================
// 3D Scene Setup
// ===================================

/**
 * Initialize Three.js 3D scene
 */
function init3DScene() {
    const container = document.getElementById('container');
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;
    
    // Create scene
    scene = new THREE.Scene();
    
    // Setup CSS3D renderer
    renderer = new THREE.CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    // Setup controls
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 0.5;
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Setup control buttons
    const buttons = document.querySelectorAll('.control-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            transform(objects, currentView);
        });
    });
    
    // Start animation loop
    animate();
}

/**
 * Create 3D objects from data
 */
function createObjects() {
    userData.forEach((person, index) => {
        // Create HTML element for each person
        const element = document.createElement('div');
        element.className = 'element';
        element.style.cssText = `
            width: 130px;
            height: 170px;
            background: ${getColorByNetWorth(person.netWorth)};
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: 'DM Sans', sans-serif;
            text-align: center;
            cursor: pointer;
            opacity: 0.95;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            backdrop-filter: blur(10px);
        `;
        
        // Set inner HTML with person details
        element.innerHTML = `
            <div style="padding: 12px;">
                <img src="${person.photo}" 
                     style="width: 85px; height: 85px; border-radius: 50%; object-fit: cover; 
                            margin-bottom: 10px; border: 3px solid rgba(255,255,255,0.3);
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
                     onerror="this.src='https://via.placeholder.com/85'">
                <div style="font-size: 12px; font-weight: 700; color: white; margin-bottom: 5px; 
                            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                            font-family: 'Outfit', sans-serif; letter-spacing: 0.3px;">
                    ${person.name}
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.8); font-weight: 500;">
                    ${person.age} • ${person.country}
                </div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.9); margin-top: 6px;
                            font-weight: 600; font-family: 'Outfit', sans-serif;">
                    $${person.netWorth.toLocaleString()}
                </div>
            </div>
        `;
        
        // Create CSS3D object and add to scene
        const objectCSS = new THREE.CSS3DObject(element);
        objectCSS.position.x = Math.random() * 4000 - 2000;
        objectCSS.position.y = Math.random() * 4000 - 2000;
        objectCSS.position.z = Math.random() * 4000 - 2000;
        scene.add(objectCSS);
        
        objects.push(objectCSS);
    });
}

// ===================================
// Layout Functions
// ===================================

/**
 * Transform objects to different layouts
 */
function transform(objects, layout) {
    const duration = 2000;
    
    objects.forEach((object, i) => {
        let position, rotation;
        
        switch(layout) {
            case 'table':
                position = tableLayout(i);
                rotation = { x: 0, y: 0, z: 0 };
                break;
            case 'sphere':
                position = sphereLayout(i, objects.length);
                rotation = { x: 0, y: 0, z: 0 };
                break;
            case 'helix':
                position = doubleHelixLayout(i);
                rotation = { x: 0, y: 0, z: 0 };
                break;
            case 'grid':
                position = gridLayout(i);
                rotation = { x: 0, y: 0, z: 0 };
                break;
        }
        
        animatePosition(object, position, rotation, duration);
    });
}

/**
 * Table layout (20x10)
 */
function tableLayout(index) {
    const cols = 20;
    const rows = 10;
    const x = (index % cols) * 150 - (cols * 150) / 2;
    const y = -(Math.floor(index / cols) % rows) * 190 + (rows * 190) / 2;
    const z = Math.floor(index / (cols * rows)) * -1000;
    return { x, y, z };
}

/**
 * Sphere layout
 */
function sphereLayout(index, total) {
    const phi = Math.acos(-1 + (2 * index) / total);
    const theta = Math.sqrt(total * Math.PI) * phi;
    const radius = 900;
    
    return {
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi)
    };
}

/**
 * Double helix layout
 */
function doubleHelixLayout(index) {
    const theta = index * 0.175 + Math.PI;
    const y = -(index * 8) + 800;
    const helix = index % 2;  // Alternate between two helixes
    const offset = helix * Math.PI;  // 180 degree offset for second helix
    
    return {
        x: Math.sin(theta + offset) * 900,
        y: y,
        z: Math.cos(theta + offset) * 900
    };
}

/**
 * Grid layout (5x4x10)
 */
function gridLayout(index) {
    const x_size = 5;
    const y_size = 4;
    
    const x = (index % x_size) * 220 - (x_size * 220) / 2;
    const y = (Math.floor(index / x_size) % y_size) * 220 - (y_size * 220) / 2;
    const z = Math.floor(index / (x_size * y_size)) * -350;
    
    return { x, y, z };
}

// ===================================
// Animation Functions
// ===================================

/**
 * Animate object position transitions
 */
function animatePosition(object, targetPosition, targetRotation, duration) {
    const startPosition = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
    };
    const startRotation = {
        x: object.rotation.x,
        y: object.rotation.y,
        z: object.rotation.z
    };
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        
        // Update position
        object.position.x = startPosition.x + (targetPosition.x - startPosition.x) * eased;
        object.position.y = startPosition.y + (targetPosition.y - startPosition.y) * eased;
        object.position.z = startPosition.z + (targetPosition.z - startPosition.z) * eased;
        
        // Update rotation
        object.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
        object.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
        object.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    update();
}

/**
 * Easing function for smooth animations
 */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Main animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===================================
// Initialize Application
// ===================================

window.addEventListener('load', function() {
    console.log('🚀 Application loaded');
    console.log('📍 Current URL:', window.location.href);
    console.log('✅ Make sure this URL is in your OAuth authorized origins');
    
    // Wait for Google API to load, then initialize
    if (typeof google !== 'undefined') {
        initializeGoogleSignIn();
    } else {
        setTimeout(initializeGoogleSignIn, 500);
    }
});