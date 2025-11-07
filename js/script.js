// API URL - Ganti dengan IP komputer Anda untuk akses dari device lain
const API_URL = 'http://localhost:3000';

// Initialize vote counts and user votes
let votes = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

let userVotes = new Set();

// Function to fetch current votes from server
async function fetchVotes() {
    try {
        const response = await fetch(`${API_URL}/data`);
        const result = await response.json();
        if (result && result.votes) {
            votes = result.votes;
            updateAllVoteCounts();
        }
    } catch (error) {
        console.error('Error fetching votes:', error);
    }
}

// Function to save votes to server
async function saveVotes() {
    try {
        const currentData = await fetch(`${API_URL}/data`).then(r => r.json());
        await fetch(`${API_URL}/data`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...currentData,
                votes: votes
            })
        });
    } catch (error) {
        console.error('Error saving votes:', error);
    }
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

// Initialize data from server
window.addEventListener('DOMContentLoaded', () => {
    fetchVotes();
    fetchUserVotes();
});

// Set up real-time updates every 5 seconds
setInterval(fetchVotes, 5000);

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
    // Increment vote count
    votes[clothingId]++;
    
    // Add to user's votes
    userVotes.add(clothingId);
    
    // Save to server
    await Promise.all([saveVotes(), saveUserVotes()]);
    
    // Update the display
    updateVoteCount(clothingId);
    updateChart();
    updateButtonStates();
}

async function cancelVote(clothingId) {
    // Decrement vote count
    if (votes[clothingId] > 0) {
        votes[clothingId]--;
    }
    
    // Remove from user's votes
    userVotes.delete(clothingId);
    
    // Save to server
    await Promise.all([saveVotes(), saveUserVotes()]);
    
    // Update the display
    updateVoteCount(clothingId);
    updateChart();
    updateButtonStates();
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