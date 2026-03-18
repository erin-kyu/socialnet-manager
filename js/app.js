// js/app.js
// ================================================================
// Section 1: Supabase Client Initialization
// ================================================================
// The supabase global object is made available by the CDN script
// loaded in the head element of index.html.
const { createClient } = supabase

// *** REPLACE THESE WITH YOUR OWN SUPABASE CREDENTIALS ***
const SUPABASE_URL = 'https://akhetrwyxpupgdsgykyi.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tmx3m7vYVgPNCtQv1YFZyQ_9amD-dNp'

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// ================================================================
// Section 2: Application State
// ================================================================
// currentProfileId holds the UUID of the profile currently shown
// in the centre panel. It is null when no profile is selected.
let currentProfileId = null

// ================================================================
// Section 3: Helper Functions
// ================================================================

/**
 * setStatus(message, isError)
 * Displays a message in the status bar at the bottom of the page.
 * When isError is true, the bar turns red to alert the user.
 */
function setStatus(message, isError = false) {
    const bar = document.getElementById('status-message')
    const footer = document.getElementById('status-bar')
    bar.textContent = message
    footer.style.background = isError ? '#6b1a1a' : 'var(--clr-status-bg)'
    footer.style.color = isError ? '#ffcccc' : 'var(--clr-status-text)'
}

/**
 * clearCentrePanel()
 * Resets the centre panel to its default empty state.
 */
function clearCentrePanel() {
    document.getElementById('profile-pic').src = 'resources/default.png'
    document.getElementById('profile-name').textContent = 'No Profile Selected'
    document.getElementById('profile-status').textContent = '—'
    document.getElementById('profile-quote').textContent = '—'
    document.getElementById('friends-list').innerHTML = ''
    currentProfileId = null
}

/**
 * displayProfile(profile, friends)
 * Renders a profile object and its friends array into the centre panel.
 */
function displayProfile(profile, friends = []) {
    document.getElementById('profile-pic').src =
        profile.picture || 'resources/default.png'
    document.getElementById('profile-pic').onerror = function () {
        this.src = 'resources/default.png'
    }
    document.getElementById('profile-name').textContent = profile.name
    document.getElementById('profile-status').textContent =
        profile.status || '(no status set)'
    document.getElementById('profile-quote').textContent =
        profile.quote || '(no quote set)'
    currentProfileId = profile.id
    renderFriendsList(friends)
    setStatus(`Displaying ${profile.name}.`)
}

/**
 * renderFriendsList(friends)
 * Builds the friends list HTML inside the centre panel.
 */
function renderFriendsList(friends) {
    const list = document.getElementById('friends-list')
    list.innerHTML = ''
    if (friends.length === 0) {
        list.innerHTML = '<p class="empty-state">No friends yet.</p>'
        return
    }
    friends.forEach(f => {
        const div = document.createElement('div')
        div.className = 'friend-entry'
        div.textContent = f.name
        list.appendChild(div)
    })
}

// ================================================================
// Section 4: CRUD Functions
// ================================================================

/**
 * loadProfileList()
 * Fetches all profile ids, names, and pictures from Supabase,
 * sorted by name, and renders them in the left panel.
 */
async function loadProfileList() {
    try {
        const { data, error } = await db
            .from('profiles')
            .select('id, name, picture')
            .order('name', { ascending: true })

        if (error) throw error

        const container = document.getElementById('profile-list')
        container.innerHTML = ''

        if (data.length === 0) {
            container.innerHTML =
                '<p class="text-muted small fst-italic p-2">No profiles found.</p>'
            return
        }

        data.forEach(profile => {
            const row = document.createElement('div')
            row.className = 'profile-item'
            row.dataset.id = profile.id

            // Thumbnail
            const img = document.createElement('img')
            img.className = 'list-thumb'
            img.src = profile.picture || 'resources/default.png'
            img.alt = profile.name
            img.onerror = function () { this.src = 'resources/default.png' }

            // Name
            const span = document.createElement('span')
            span.textContent = profile.name

            row.appendChild(img)
            row.appendChild(span)

            // Highlight if this is the currently selected profile
            if (profile.id === currentProfileId) {
                row.classList.add('active')
            }

            row.addEventListener('click', () => selectProfile(profile.id))
            container.appendChild(row)
        })
    } catch (err) {
        setStatus(`Error loading profiles: ${err.message}`, true)
    }
}

/**
 * selectProfile(profileId)
 * Fetches the full profile data and friend list for the given UUID.
 */
async function selectProfile(profileId) {
    try {
        // Highlight the active item in the profile list
        document.querySelectorAll('#profile-list .profile-item')
            .forEach(el => {
                el.classList.toggle('active', el.dataset.id === profileId)
            })

        // Fetch the full profile row by primary key
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single()

        if (profileError) throw profileError

        // Fetch friends (bidirectional)
        // Get all friend rows where this profile is on either side
        const { data: friendRows, error: friendsError } = await db
            .from('friends')
            .select('profile_id, friend_id')
            .or(`profile_id.eq.${profileId},friend_id.eq.${profileId}`)

        if (friendsError) throw friendsError

        // Extract the OTHER profile's UUID from each row
        const friendIds = friendRows.map(row =>
            row.profile_id === profileId ? row.friend_id : row.profile_id
        )

        // Fetch friend names
        let friends = []
        if (friendIds.length > 0) {
            const { data: friendProfiles, error: namesError } = await db
                .from('profiles')
                .select('id, name')
                .in('id', friendIds)
                .order('name', { ascending: true })

            if (namesError) throw namesError
            friends = friendProfiles
        }

        displayProfile(profile, friends)

    } catch (err) {
        setStatus(`Error selecting profile: ${err.message}`, true)
    }
}

/**
 * addProfile()
 * Reads the name input, validates, inserts a new row, reloads the list.
 */
async function addProfile() {
    const nameInput = document.getElementById('input-name')
    const name = nameInput.value.trim()

    if (!name) {
        setStatus('Error: Name field is empty. Please enter a name.', true)
        return
    }

    try {
        const { data, error } = await db
            .from('profiles')
            .insert({ name })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                setStatus(`Error: A profile named "${name}" already exists.`, true)
            } else {
                throw error
            }
            return
        }

        nameInput.value = ''
        await loadProfileList()
        await selectProfile(data.id)
        setStatus(`Profile "${name}" created successfully.`)

    } catch (err) {
        setStatus(`Error adding profile: ${err.message}`, true)
    }
}

/**
 * lookUpProfile()
 * Performs a case-insensitive partial name search.
 */
async function lookUpProfile() {
    const query = document.getElementById('input-name').value.trim()

    if (!query) {
        setStatus('Error: Search field is empty. Please enter a name to search.', true)
        return
    }

    try {
        const { data, error } = await db
            .from('profiles')
            .select('id, name')
            .ilike('name', `%${query}%`)
            .order('name', { ascending: true })
            .limit(1)

        if (error) throw error

        if (data.length === 0) {
            setStatus(`No profile found matching "${query}".`, true)
            clearCentrePanel()
            return
        }

        await selectProfile(data[0].id)

    } catch (err) {
        setStatus(`Error looking up profile: ${err.message}`, true)
    }
}

/**
 * deleteProfile()
 * Deletes the currently selected profile from Supabase.
 */
async function deleteProfile() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected. Click a profile in the list first.', true)
        return
    }

    const name = document.getElementById('profile-name').textContent

    if (!window.confirm(`Delete the profile for "${name}"? This cannot be undone.`)) {
        setStatus('Deletion cancelled.')
        return
    }

    try {
        const { error } = await db
            .from('profiles')
            .delete()
            .eq('id', currentProfileId)

        if (error) throw error

        clearCentrePanel()
        await loadProfileList()
        setStatus(`Profile "${name}" deleted. Friend relationships removed automatically.`)

    } catch (err) {
        setStatus(`Error deleting profile: ${err.message}`, true)
    }
}

/**
 * changeStatus()
 * Updates the status column for the current profile.
 */
async function changeStatus() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const newStatus = document.getElementById('input-status').value.trim()

    if (!newStatus) {
        setStatus('Error: Status field is empty.', true)
        return
    }

    try {
        const { error } = await db
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', currentProfileId)

        if (error) throw error

        document.getElementById('profile-status').textContent = newStatus
        document.getElementById('input-status').value = ''
        setStatus('Status updated.')

    } catch (err) {
        setStatus(`Error updating status: ${err.message}`, true)
    }
}

/**
 * changeQuote()
 * Updates the quote column for the current profile.
 */
async function changeQuote() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const newQuote = document.getElementById('input-quote').value.trim()

    if (!newQuote) {
        setStatus('Error: Quote field is empty.', true)
        return
    }

    try {
        const { error } = await db
            .from('profiles')
            .update({ quote: newQuote })
            .eq('id', currentProfileId)

        if (error) throw error

        document.getElementById('profile-quote').textContent = newQuote
        document.getElementById('input-quote').value = ''
        setStatus('Favorite quote updated.')

    } catch (err) {
        setStatus(`Error updating quote: ${err.message}`, true)
    }
}

/**
 * changePicture()
 * Updates the picture column with a new relative path.
 */
async function changePicture() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const newPicture = document.getElementById('input-picture').value.trim()

    if (!newPicture) {
        setStatus('Error: Picture field is empty.', true)
        return
    }

    try {
        const { error } = await db
            .from('profiles')
            .update({ picture: newPicture })
            .eq('id', currentProfileId)

        if (error) throw error

        document.getElementById('profile-pic').src = newPicture
        document.getElementById('input-picture').value = ''
        await loadProfileList()
        setStatus('Picture updated.')

    } catch (err) {
        setStatus(`Error updating picture: ${err.message}`, true)
    }
}

// ================================================================
// Section 5: Friends Management
// ================================================================

/**
 * addFriend()
 * Looks up the friend's profile by name, validates,
 * and inserts a new row in the friends table (bidirectional).
 */
async function addFriend() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const friendName = document.getElementById('input-friend').value.trim()

    if (!friendName) {
        setStatus('Error: Friend name field is empty.', true)
        return
    }

    try {
        // Step 1: Resolve the friend's name to a UUID
        const { data: found, error: findError } = await db
            .from('profiles')
            .select('id, name')
            .ilike('name', friendName)
            .limit(1)

        if (findError) throw findError

        if (found.length === 0) {
            setStatus(`Error: No profile named "${friendName}" exists. Add that profile first.`, true)
            return
        }

        const friendId = found[0].id

        // Step 2: Prevent self-friendship
        if (friendId === currentProfileId) {
            setStatus('Error: A profile cannot be friends with itself.', true)
            return
        }

        // Step 3: Normalize UUIDs so smaller one is always profile_id
        // This ensures the UNIQUE constraint catches duplicates regardless of direction
        const pid = currentProfileId < friendId ? currentProfileId : friendId
        const fid = currentProfileId < friendId ? friendId : currentProfileId

        // Step 4: Insert the canonical friendship row
        const { error: insertError } = await db
            .from('friends')
            .insert({ profile_id: pid, friend_id: fid })

        if (insertError) {
            if (insertError.code === '23505') {
                setStatus(`"${found[0].name}" is already in the friends list.`, true)
            } else {
                throw insertError
            }
            return
        }

        document.getElementById('input-friend').value = ''
        await selectProfile(currentProfileId) // re-render to show new friend
        setStatus(`"${found[0].name}" added as a friend (bidirectional).`)

    } catch (err) {
        setStatus(`Error adding friend: ${err.message}`, true)
    }
}

/**
 * removeFriend()
 * Looks up the friend's profile by name and deletes the friendship row.
 */
async function removeFriend() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const friendName = document.getElementById('input-friend').value.trim()

    if (!friendName) {
        setStatus('Error: Friend name field is empty.', true)
        return
    }

    try {
        // Resolve the name to a UUID
        const { data: found, error: findError } = await db
            .from('profiles')
            .select('id, name')
            .ilike('name', friendName)
            .limit(1)

        if (findError) throw findError

        if (found.length === 0) {
            setStatus(`Error: No profile named "${friendName}" exists.`, true)
            return
        }

        const friendId = found[0].id

        // Normalize to match canonical row
        const pid = currentProfileId < friendId ? currentProfileId : friendId
        const fid = currentProfileId < friendId ? friendId : currentProfileId

        // Delete the canonical row
        const { error: deleteError } = await db
            .from('friends')
            .delete()
            .eq('profile_id', pid)
            .eq('friend_id', fid)

        if (deleteError) throw deleteError

        document.getElementById('input-friend').value = ''
        await selectProfile(currentProfileId) // re-render
        setStatus(`"${found[0].name}" removed from friends list.`)

    } catch (err) {
        setStatus(`Error removing friend: ${err.message}`, true)
    }
}

// ================================================================
// Section 6: Event Listener Setup
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {

    // ── Left panel buttons ─────────────────────────────────────────
    document.getElementById('btn-add')
        .addEventListener('click', addProfile)

    document.getElementById('btn-lookup')
        .addEventListener('click', lookUpProfile)

    document.getElementById('btn-delete')
        .addEventListener('click', deleteProfile)

    // ── Right panel buttons ────────────────────────────────────────
    document.getElementById('btn-status')
        .addEventListener('click', changeStatus)

    document.getElementById('btn-quote')
        .addEventListener('click', changeQuote)

    document.getElementById('btn-picture')
        .addEventListener('click', changePicture)

    document.getElementById('btn-add-friend')
        .addEventListener('click', addFriend)

    document.getElementById('btn-remove-friend')
        .addEventListener('click', removeFriend)

    // ── Exit button ──────────────────────────────────────────────────
    document.getElementById('btn-exit')
        .addEventListener('click', () => {
            if (!window.close()) setStatus('To exit, close this browser tab.')
        })

    // ── Enter key shortcuts ────────────────────────────────────────
    document.getElementById('input-name')
        .addEventListener('keydown', e => { if (e.key === 'Enter') addProfile() })

    document.getElementById('input-status')
        .addEventListener('keydown', e => { if (e.key === 'Enter') changeStatus() })

    document.getElementById('input-quote')
        .addEventListener('keydown', e => { if (e.key === 'Enter') changeQuote() })

    document.getElementById('input-friend')
        .addEventListener('keydown', e => { if (e.key === 'Enter') addFriend() })

    // ── Initial data load ──────────────────────────────────────────
    await loadProfileList()
    setStatus('Ready. Select a profile from the list or add a new one.')
})
