const fetchButton = document.getElementById('fetch');
const saveButton = document.getElementById('save');
const adminURL = document.getElementById('admin-url');
const textarea = document.getElementById('textarea');
const method = document.getElementById('method');

fetchButton.addEventListener('click', async () => {
    localStorage.setItem('admin-url', adminURL.value);
    const resp = await fetch(adminURL.value);
    const text = await resp.text();
    textarea.value = text;
});

saveButton.addEventListener('click', async () => {
    localStorage.setItem('admin-url', adminURL.value);
    const resp = await fetch(adminURL.value, {
        method: method.value,
        body: textarea.value,
        headers: {
            'content-type': adminURL.value.endsWith('.yaml') ? 'text/yaml' : 'application/json',
        }
    });
    const text = await resp.text();
    console.log(text);
});

adminURL.value = localStorage.getItem('admin-url')||'';
