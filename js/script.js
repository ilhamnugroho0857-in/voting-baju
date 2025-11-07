// Initialize vote counts and user votes (declare early to avoid TDZ issues)
let votes = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

let userVotes = new Set();
let lastUpdate = '';

// Supabase configuration
// Ganti SUPABASE_URL dengan Project URL Anda (mis. https://abcd1234.supabase.co)
const SUPABASE_URL = 'https://aankoycijlylozbcjesa.supabase.co'; // <-- DIGANTI DARI INPUT USER

// Supabase anon public key (aman digunakan di client). Nilai yang Anda berikan dimasukkan di sini.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbmtveWNpamx5bG96YmNqZXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzM5MDQsImV4cCI6MjA3ODEwOTkwNH0.HZY0Tj_SM719eLGf1OeNUDAGaNztqzhYEx5xkaIF0kI';

// Create supabase client safely (may fail if library not loaded)
let supabaseClient = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof createClient === 'function') {
        // some builds expose createClient globally
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('Supabase client not available. Falling back to localStorage-only mode.');
    }
} catch (e) {
    console.warn('Error initializing Supabase client:', e);
}

// Load data from Supabase
async function loadFromDatabase() {
    try {
        const { data, error } = await supabaseClient
            .from('voting_data')
            .select('*')
            .single();

        if (error) throw error;

        if (data) {
            votes = data.votes;
            userVotes = new Set(data.user_votes);
            lastUpdate = data.last_update;
            updateAllVoteCounts();
            updateButtonStates();
            updateChart();
        } else {
            // Initialize database if no data exists
            await saveToDatabase();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage if database fails
        loadFromStorage();
    }
}

// Save data to Supabase
async function saveToDatabase() {
    try {
        const { error } = await supabaseClient
            .from('voting_data')
            .upsert({
                id: 1, // Single record
                votes: votes,
                user_votes: Array.from(userVotes),
                last_update: new Date().toISOString()
            });

        if (error) throw error;

        // Also save to localStorage as backup
        saveToStorage();
        
    } catch (error) {
        console.error('Error saving to database:', error);
        // Tampilkan error detail pada notifikasi agar mudah debug
        const msg = (error && error.message) ? `Gagal menyimpan ke database: ${error.message}` : 'Gagal menyimpan ke database.';
        showNotification(msg, true);
        // Fallback to localStorage if database fails
        saveToStorage();
    }
}

// Backup localStorage functions
function loadFromStorage() {
    const savedVotes = localStorage.getItem('votingData');
    if (savedVotes) {
        const data = JSON.parse(savedVotes);
        votes = data.votes;
        userVotes = new Set(data.userVotes);
        lastUpdate = data.lastUpdate;
        updateAllVoteCounts();
        updateButtonStates();
        updateChart();
    }
}

function saveToStorage() {
    const data = {
        votes: votes,
        userVotes: Array.from(userVotes),
        lastUpdate: new Date().toISOString()
    };
    localStorage.setItem('votingData', JSON.stringify(data));
}

// Subscribe to real-time changes
function subscribeToChanges() {
    if (!supabaseClient) return;
    supabaseClient
        .channel('voting_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'voting_data' },
            payload => {
                if (payload.new) {
                    votes = payload.new.votes;
                    userVotes = new Set(payload.new.user_votes);
                    lastUpdate = payload.new.last_update;
                    updateAllVoteCounts();
                    updateButtonStates();
                    updateChart();
                }
            }
        )
    .subscribe();
}

// Fungsi untuk mendapatkan data voting terbaru
async function getLatestVotingData() {
    try {
        const response = await fetch(`${API_URL}/votingData`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching voting data:', error);
        return null;
    }
}

// Function to fetch current votes from server
async function fetchVotes() {
    try {
        const data = await getLatestVotingData();
        if (data && data.lastUpdate !== lastUpdate) {
            votes = data.votes;
            userVotes = new Set(data.userVotes);
            lastUpdate = data.lastUpdate;
            updateAllVoteCounts();
            updateButtonStates();
            updateChart();
        }
    } catch (error) {
        console.error('Error fetching votes:', error);
    }
}

// Function to save votes to server
async function saveVotes() {
    try {
        const response = await fetch(`${API_URL}/votingData`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                votes: votes,
                userVotes: Array.from(userVotes),
                lastUpdate: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save votes');
        }

        // Tampilkan notifikasi bahwa vote berhasil disimpan
        showNotification('Vote berhasil disimpan!');
    } catch (error) {
        console.error('Error saving votes:', error);
        showNotification('Gagal menyimpan vote. Silakan coba lagi.', true);
    }
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#ff0000' : '#000000'};
        color: white;
        padding: 15px 30px;
        border-radius: 25px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: fadeInOut 3s forwards;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to fetch user votes from server
async function fetchUserVotes() {
    try {
        const response = await fetch(`${API_URL}/userVotes`);
        const data = await response.json();
        userVotes = new Set(data);
        updateButtonStates();
    } catch (error) {
        console.error('Error fetching user votes:', error);
    }
}

// Function to save user votes to server
async function saveUserVotes() {
    try {
        await fetch(`${API_URL}/userVotes`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([...userVotes])
        });
    } catch (error) {
        console.error('Error saving user votes:', error);
    }
}

// Initialize data when page loads
window.addEventListener('DOMContentLoaded', async () => {
    await loadFromDatabase();
    subscribeToChanges();
});

// Function to reset all votes
async function resetAllVotes() {
    if (confirm('Apakah Anda yakin ingin menghapus semua vote? Tindakan ini tidak dapat dibatalkan.')) {
        // Reset vote counts
        votes = {
            1: 0,
            2: 0,
            3: 0,
            4: 0
        };
        
        // Reset user votes
        userVotes = new Set();
        
        // Reset server data
        await Promise.all([
            fetch(`${API_URL}/votes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(votes)
            }),
            fetch(`${API_URL}/userVotes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([])
            })
        ]);
        
        // Update display
        updateAllVoteCounts();
        updateButtonStates();
        
        // Show confirmation message
        const confirmationMessage = document.createElement('div');
        confirmationMessage.textContent = 'Semua vote telah dihapus!';
        confirmationMessage.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: fadeInOut 3s forwards;
        `;
        
        document.body.appendChild(confirmationMessage);
        
        // Remove the message after animation
        setTimeout(() => {
            confirmationMessage.remove();
        }, 3000);
    }
}

// Add CSS animation for the confirmation message
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -20px); }
        15% { opacity: 1; transform: translate(-50%, 0); }
        85% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
    }
`;
document.head.appendChild(style);

// Check if there are saved votes in localStorage
const savedVotes = localStorage.getItem('clothingVotes');
const savedUserVotes = localStorage.getItem('userVotes');

if (savedVotes) {
    votes = JSON.parse(savedVotes);
    updateAllVoteCounts();
}

if (savedUserVotes) {
    userVotes = new Set(JSON.parse(savedUserVotes));
    updateButtonStates();
}

async function vote(clothingId) {
    try {
        // Increment vote count
        votes[clothingId]++;
        userVotes.add(clothingId);
        
        // Save to database
        await saveToDatabase();
        
        // Update the display
        updateVoteCount(clothingId);
        updateChart();
        updateButtonStates();
        
        showNotification('Vote berhasil disimpan!');
    } catch (error) {
        console.error('Error during voting:', error);
        showNotification('Gagal melakukan voting. Silakan coba lagi.', true);
    }
}

async function cancelVote(clothingId) {
    try {
        // Decrement vote count
        if (votes[clothingId] > 0) {
            votes[clothingId]--;
        }
        
        // Remove from user's votes
        userVotes.delete(clothingId);
        
        // Save to database
        await saveToDatabase();
        
        // Update the display
        updateVoteCount(clothingId);
        updateChart();
        updateButtonStates();

        showNotification('Vote berhasil dibatalkan!');
    } catch (error) {
        console.error('Error during vote cancellation:', error);
        showNotification('Gagal membatalkan vote. Silakan coba lagi.', true);
    }
}

function updateButtonStates() {
    // Update all buttons visibility
    for (let i = 1; i <= 4; i++) {
        const voteBtn = document.getElementById(`voteBtn${i}`);
        const cancelBtn = document.getElementById(`cancelBtn${i}`);
        
        if (userVotes.has(i)) {
            voteBtn.style.display = 'none';
            cancelBtn.style.display = 'block';
        } else {
            voteBtn.style.display = 'block';
            cancelBtn.style.display = 'none';
        }
    }
}

function updateVoteCount(clothingId) {
    const voteElement = document.getElementById(`votes${clothingId}`);
    voteElement.textContent = votes[clothingId];
}

function updateAllVoteCounts() {
    for (let i = 1; i <= 4; i++) {
        updateVoteCount(i);
    }
    updateChart();
}

function updateChart() {
    const resultsChart = document.getElementById('results-chart');
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    
    let chartHTML = '';
    
    for (let i = 1; i <= 4; i++) {
        const percentage = totalVotes > 0 ? (votes[i] / totalVotes * 100).toFixed(1) : 0;
        chartHTML += `
            <div style="margin-bottom: 25px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 80px; font-weight: 500; color: #2d3436;">Baju ${i}:</span>
                    <div style="flex-grow: 1; background-color: #333333; border-radius: 10px; overflow: hidden; height: 25px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
                        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(45deg, #ff0000, #cc0000); transition: width 1s ease-in-out;"></div>
                    </div>
                    <span style="margin-left: 15px; font-weight: 600; color: #2d3436; min-width: 60px;">${percentage}%</span>
                </div>
                <div style="font-size: 0.9em; color: #636e72; padding-left: 80px;">
                    Total vote: <span style="font-weight: 500; color: #2d3436;">${votes[i]}</span>
                </div>
            </div>
        `;
    }
    
    resultsChart.innerHTML = chartHTML;
}