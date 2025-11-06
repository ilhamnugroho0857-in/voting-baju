// Initialize vote counts and user votes
let votes = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

let userVotes = new Set();

// Function to reset all votes
function resetAllVotes() {
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
        
        // Clear localStorage
        localStorage.removeItem('clothingVotes');
        localStorage.removeItem('userVotes');
        
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

function vote(clothingId) {
    // Increment vote count
    votes[clothingId]++;
    
    // Add to user's votes
    userVotes.add(clothingId);
    
    // Save to localStorage
    localStorage.setItem('clothingVotes', JSON.stringify(votes));
    localStorage.setItem('userVotes', JSON.stringify([...userVotes]));
    
    // Update the display
    updateVoteCount(clothingId);
    updateChart();
    updateButtonStates();
}

function cancelVote(clothingId) {
    // Decrement vote count
    if (votes[clothingId] > 0) {
        votes[clothingId]--;
    }
    
    // Remove from user's votes
    userVotes.delete(clothingId);
    
    // Save to localStorage
    localStorage.setItem('clothingVotes', JSON.stringify(votes));
    localStorage.setItem('userVotes', JSON.stringify([...userVotes]));
    
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