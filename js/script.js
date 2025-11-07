// Inisialisasi hitungan vote dan vote pengguna
let votes = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

let userVotes = new Set();
let lastUpdate = '';

// Konfigurasi Supabase
const SUPABASE_URL = 'https://aankoycijlylozbcjesa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbmtveWNpamx5bG96YmNqZXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzM5MDQsImV4cCI6MjA3ODEwOTkwNH0.HZY0Tj_SM719eLGf1OeNUDAGaNztqzhYEx5xkaIF0kI';

// Utilitas untuk operasi umum
const utils = {
    async retryOperation(fn, maxAttempts = 3) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await fn();
                return true;
            } catch (error) {
                console.error(`Percobaan ke-${i + 1} gagal:`, error);
                if (i < maxAttempts - 1) {
                    this.showNotification(`Mencoba menghubungkan kembali... (${i + 2}/${maxAttempts})`, true);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }
        return false;
    },

    showNotification(message, isError = false) {
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
};

// Buat atau ambil ID unik untuk tiap perangkat (bertindak seperti "akun" lokal)
const CLIENT_ID_KEY = 'votingClientId';
let clientId = localStorage.getItem(CLIENT_ID_KEY);
if (!clientId) {
    clientId = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10);
    localStorage.setItem(CLIENT_ID_KEY, clientId);
}
console.log('Client ID:', clientId);

// Inisialisasi Supabase client
let supabaseClient = null;
try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Kredensial Supabase tidak tersedia');
    }
    
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client berhasil diinisialisasi');
    } else if (typeof createClient === 'function') {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client berhasil diinisialisasi (createClient global)');
    } else {
        throw new Error('Library Supabase tidak tersedia');
    }
} catch (e) {
    console.error('Kesalahan inisialisasi Supabase client:', e);
    utils.showNotification(`Gagal menginisialisasi koneksi database: ${e.message}`, true);
}

// Fungsi untuk menyimpan data ke Supabase
async function saveToDatabase() {
    if (!supabaseClient) {
        // Jika client tidak tersedia, simpan sebagai pending dan lempar error
        saveToStorage();
        localStorage.setItem('pendingVotingData', JSON.stringify({
            votes: votes,
            userVotes: Array.from(userVotes),
            lastUpdate: new Date().toISOString()
        }));
        throw new Error('Supabase client tidak tersedia');
    }

    const { data, error } = await supabaseClient
        .from('voting_data')
        .upsert({
            id: 1,
            votes: votes,
            last_update: new Date().toISOString()
        })
        .select();

    if (error) {
        // Simpan lokal dan tandai sebagai pending agar bisa disinkronkan nanti
        saveToStorage();
        localStorage.setItem('pendingVotingData', JSON.stringify({
            votes: votes,
            userVotes: Array.from(userVotes),
            lastUpdate: new Date().toISOString()
        }));
        throw error;
    }

    // Sukses: simpan lokal sebagai cadangan dan hapus pending
    saveToStorage();
    localStorage.removeItem('pendingVotingData');
    return data;
}

// Sinkronisasi pending data (jika ada) ke Supabase
async function syncPendingVotingData() {
    const pending = localStorage.getItem('pendingVotingData');
    if (!pending) return false;

    try {
        const parsed = JSON.parse(pending);
        // Terapkan ke memori agar UI mencerminkan state lokal
        votes = parsed.votes || votes;
        userVotes = new Set(parsed.userVotes || Array.from(userVotes));
        lastUpdate = parsed.lastUpdate || lastUpdate;
        updateAllVoteCounts();
        updateButtonStates();

        if (!supabaseClient) throw new Error('Supabase client tidak tersedia');

        const { error } = await supabaseClient
            .from('voting_data')
            .upsert({
                id: 1,
                votes: votes,
                last_update: new Date().toISOString()
            });

        if (error) throw error;

        // Jika sukses, hapus pending
        localStorage.removeItem('pendingVotingData');
        utils.showNotification('Data lokal berhasil disinkronkan ke server', false);
        return true;
    } catch (error) {
        console.error('Gagal menyinkronkan pending data:', error);
        utils.showNotification('Gagal menyinkronkan data lokal. Akan dicoba nanti.', true);
        return false;
    }
}

// Fungsi untuk memuat data dari Supabase
async function loadFromDatabase() {
    try {
        if (!supabaseClient) {
            throw new Error('Tidak dapat terhubung ke database');
        }

        const { data, error } = await supabaseClient
            .from('voting_data')
            .select('*')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                utils.showNotification('Memulai database baru...', false);
                await saveToDatabase();
                return;
            }
            throw error;
        }

        if (data) {
            // Ambil counts dari server, tetapi jangan timpa userVotes lokal tiap perangkat
            votes = data.votes || votes;
            lastUpdate = data.last_update || lastUpdate;
            updateAllVoteCounts();
            updateButtonStates();
            updateChart();
            utils.showNotification('Data berhasil dimuat dari server', false);
        }
    } catch (error) {
        console.error('Kesalahan saat memuat data:', error);
        utils.showNotification(`Tidak dapat memuat data dari server: ${error.message}. Menggunakan data lokal...`, true);
        loadFromStorage();
    }
}

// Fungsi untuk voting
async function vote(clothingId) {
    try {
        if (!supabaseClient) {
            throw new Error('Tidak dapat terhubung ke database. Periksa koneksi internet Anda');
        }

        votes[clothingId]++;
        userVotes.add(clothingId);
        
        const saved = await utils.retryOperation(async () => {
            await saveToDatabase();
        });
        
        if (!saved) {
            throw new Error('Gagal menyimpan vote setelah beberapa kali percobaan');
        }
        
        updateVoteCount(clothingId);
        updateChart();
        updateButtonStates();
        
        utils.showNotification('Vote berhasil disimpan! Terima kasih telah berpartisipasi');
    } catch (error) {
        console.error('Kesalahan saat voting:', error);
        // Jika gagal menyimpan ke server, simpan lokal dan tandai untuk sinkronisasi
        saveToStorage();
        localStorage.setItem('pendingVotingData', JSON.stringify({
            votes: votes,
            userVotes: Array.from(userVotes),
            lastUpdate: new Date().toISOString()
        }));
        utils.showNotification(`Vote disimpan secara lokal dan akan disinkronkan: ${error.message}`, false);
    }
}

// Fungsi untuk membatalkan vote
async function cancelVote(clothingId) {
    try {
        if (!supabaseClient) {
            throw new Error('Tidak dapat terhubung ke database. Periksa koneksi internet Anda');
        }

        if (votes[clothingId] > 0) {
            votes[clothingId]--;
        }
        
        userVotes.delete(clothingId);
        
        const saved = await utils.retryOperation(async () => {
            await saveToDatabase();
        });
        
        if (!saved) {
            throw new Error('Gagal membatalkan vote setelah beberapa kali percobaan');
        }
        
        updateVoteCount(clothingId);
        updateChart();
        updateButtonStates();

        utils.showNotification('Vote berhasil dibatalkan!');
    } catch (error) {
        console.error('Kesalahan saat membatalkan vote:', error);
        // Jika gagal menyimpan pembatalan ke server, simpan lokal dan tandai pending
        saveToStorage();
        localStorage.setItem('pendingVotingData', JSON.stringify({
            votes: votes,
            userVotes: Array.from(userVotes),
            lastUpdate: new Date().toISOString()
        }));
        utils.showNotification(`Pembatalan vote disimpan lokal dan akan disinkronkan: ${error.message}`, false);
    }
}

// Fungsi untuk menyimpan ke localStorage
function saveToStorage() {
    const data = {
        votes: votes,
        userVotes: Array.from(userVotes),
        lastUpdate: new Date().toISOString()
    };
    localStorage.setItem('votingData', JSON.stringify(data));
}

// Fungsi untuk memuat dari localStorage
function loadFromStorage() {
    const savedData = localStorage.getItem('votingData');
    if (savedData) {
        const data = JSON.parse(savedData);
        votes = data.votes;
        userVotes = new Set(data.userVotes);
        lastUpdate = data.lastUpdate;
        updateAllVoteCounts();
        updateButtonStates();
        updateChart();
    }
}

// Fungsi untuk berlangganan perubahan real-time
function subscribeToChanges() {
    if (!supabaseClient) {
        console.warn('Tidak dapat berlangganan perubahan real-time: client tidak tersedia');
        return;
    }
    
    const channel = supabaseClient
        .channel('voting_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'voting_data' },
            payload => {
                if (payload.new) {
                    votes = payload.new.votes;
                    lastUpdate = payload.new.last_update;
                    updateAllVoteCounts();
                    updateButtonStates();
                    updateChart();
                    utils.showNotification('Data voting telah diperbarui', false);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Berhasil berlangganan perubahan real-time');
            }
        });
}

// Fungsi pembaruan tampilan
function updateVoteCount(clothingId) {
    const voteElement = document.getElementById(`votes${clothingId}`);
    if (voteElement) {
        voteElement.textContent = votes[clothingId];
    }
}

function updateAllVoteCounts() {
    for (let i = 1; i <= 4; i++) {
        updateVoteCount(i);
    }
    updateChart();
}

function updateButtonStates() {
    for (let i = 1; i <= 4; i++) {
        const voteBtn = document.getElementById(`voteBtn${i}`);
        const cancelBtn = document.getElementById(`cancelBtn${i}`);
        
        if (voteBtn && cancelBtn) {
            if (userVotes.has(i)) {
                voteBtn.style.display = 'none';
                cancelBtn.style.display = 'block';
            } else {
                voteBtn.style.display = 'block';
                cancelBtn.style.display = 'none';
            }
        }
    }
}

function updateChart() {
    const resultsChart = document.getElementById('results-chart');
    if (!resultsChart) return;

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

// Inisialisasi saat halaman dimuat
window.addEventListener('DOMContentLoaded', async () => {
    // Coba sinkronkan data lokal yang pending terlebih dahulu
    try {
        await syncPendingVotingData();
    } catch (e) {
        console.warn('Sinkronisasi pending gagal atau tidak diperlukan:', e);
    }

    await loadFromDatabase();
    subscribeToChanges();
});

// Pastikan fungsi yang dipanggil dari atribut onclick tersedia di scope global
window.vote = vote;
window.cancelVote = cancelVote;
window.syncPendingVotingData = syncPendingVotingData;