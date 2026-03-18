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
// Section 2: Application Constants and State
// ================================================================

// DEFAULT_AVATAR is shown whenever a profile has no picture stored
// in Supabase, or when an image fails to load.
// *** REPLACE THIS WITH YOUR OWN VERCEL BLOB DEFAULT AVATAR URL ***
const DEFAULT_AVATAR = 'https://hjybfixkvzrdybnu.public.blob.vercel-storage.com/avatars/default.png'

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
    document.getElementById('profile-pic').src = DEFAULT_AVATAR
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
        profile.picture || DEFAULT_AVATAR
    document.getElementById('profile-pic').onerror = function () {
        this.src = DEFAULT_AVATAR
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

/**
 * showUploadProgress / hideUploadProgress
 * Shows/hides the animated progress bar during image upload.
 */
function showUploadProgress(label = 'Uploading...') {
    const wrapper = document.getElementById('upload-progress')
    const text = document.getElementById('upload-progress-label')
    text.textContent = label
    wrapper.hidden = false
}

function hideUploadProgress() {
    document.getElementById('upload-progress').hidden = true
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
            img.src = profile.picture || DEFAULT_AVATAR
            img.alt = profile.name
            img.onerror = function () { this.src = DEFAULT_AVATAR }

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

// ================================================================
// Section 5: Picture Update — Vercel Blob Upload
// ================================================================

/**
 * changePicture()
 * Supports two modes:
 *   Mode A — File upload (priority): uploads via /api/upload-avatar
 *   Mode B — URL input (fallback): saves URL directly to Supabase
 */
async function changePicture() {
    if (!currentProfileId) {
        setStatus('Error: No profile is selected.', true)
        return
    }

    const fileInput = document.getElementById('input-picture-file')
    const urlInput = document.getElementById('input-picture-url')
    const file = fileInput.files[0]
    const urlValue = urlInput.value.trim()

    // Mode A: File upload
    if (file) {
        await uploadFileToBlob(file)
        return
    }

    // Mode B: Direct URL
    if (urlValue) {
        await saveUrlDirectly(urlValue)
        return
    }

    setStatus('Error: Select a file or enter a URL before clicking Update Picture.', true)
}

/**
 * uploadFileToBlob(file)
 * Sends the selected File to /api/upload-avatar, receives the
 * compressed Vercel Blob URL, and saves it to Supabase.
 */
async function uploadFileToBlob(file) {
    if (!file.type.startsWith('image/')) {
        setStatus('Error: The selected file is not an image.', true)
        return
    }

    showUploadProgress('Compressing and uploading...')
    setStatus('Uploading image to Vercel Blob...')

    try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload-avatar', {
            method: 'POST',
            body: formData,
            // Do NOT set Content-Type manually — browser sets it with boundary
        })

        // Safe response parsing: read text first, then try JSON
        const rawText = await response.text()

        console.log(
            `[upload-avatar] HTTP ${response.status} ${response.statusText}`,
            response.ok ? '(success)' : '(error)',
            '\nRaw body:',
            rawText.slice(0, 500)
        )

        let result
        try {
            result = JSON.parse(rawText)
        } catch {
            const preview = rawText.slice(0, 200).replace(/\s+/g, ' ').trim()
            const hint = diagnoseUploadStatus(response.status)
            throw new Error(
                'Server returned HTTP ' + response.status +
                ' (not JSON). ' + hint +
                ' | Response: "' + preview + '"'
            )
        }

        if (!response.ok) {
            throw new Error(result.error || 'Server error ' + response.status + '.')
        }

        const blobUrl = result.url
        await savePictureUrl(blobUrl)

        document.getElementById('input-picture-file').value = ''
    } catch (err) {
        setStatus('Error uploading image: ' + err.message, true)
    } finally {
        hideUploadProgress()
    }
}

/**
 * diagnoseUploadStatus(status)
 * Returns a hint for common HTTP errors from /api/upload-avatar.
 */
function diagnoseUploadStatus(status) {
    switch (status) {
        case 401:
        case 403:
            return 'Check that BLOB_READ_WRITE_TOKEN is set in Vercel Environment Variables.'
        case 404:
            return 'api/upload-avatar.js was not found. Verify the file is in the /api folder at the repo root.'
        case 405:
            return 'Wrong HTTP method. The function only accepts POST requests.'
        case 413:
            return 'File too large. The Vercel function config sizeLimit is 10 MB.'
        case 500:
            return 'The serverless function crashed. Check Vercel Dashboard → Functions → Logs.'
        case 504:
            return 'The serverless function timed out. Try a smaller file.'
        default:
            return 'Check Vercel Dashboard → Functions → Logs for more details.'
    }
}

/**
 * saveUrlDirectly(url)
 * Validates and saves a pasted URL to Supabase without uploading to Blob.
 */
async function saveUrlDirectly(url) {
    if (!url.startsWith('https://')) {
        setStatus('Error: URL must start with https://', true)
        return
    }

    setStatus('Saving picture URL...')

    try {
        await savePictureUrl(url)
    } catch (err) {
        setStatus(`Error saving URL: ${err.message}`, true)
    }
}

/**
 * savePictureUrl(newPictureUrl)
 * Shared helper: updates the picture column in Supabase and refreshes the UI.
 */
async function savePictureUrl(newPictureUrl) {
    const { error } = await db
        .from('profiles')
        .update({ picture: newPictureUrl })
        .eq('id', currentProfileId)

    if (error) throw error

    document.getElementById('profile-pic').src = newPictureUrl

    const activeThumb = document.querySelector(
        '#profile-list .profile-item.active .list-thumb'
    )
    if (activeThumb) activeThumb.src = newPictureUrl

    document.getElementById('input-picture-url').value = ''
    setStatus('Picture updated successfully.')
}

// ================================================================
// Section 6: Friends Management
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
// Section 7: Event Listener Setup
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

    // Live preview: when user picks a file, show local preview immediately
    document.getElementById('input-picture-file').addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!file.type.startsWith('image/')) return

        const pic = document.getElementById('profile-pic')
        if (pic.dataset.previewUrl) {
            URL.revokeObjectURL(pic.dataset.previewUrl)
        }

        const previewUrl = URL.createObjectURL(file)
        pic.src = previewUrl
        pic.dataset.previewUrl = previewUrl
        setStatus("Preview loaded. Click 'Update Picture' to save to Vercel Blob.")
    })

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