const WHATSAPP_NUMBER = '2348000000000'; // Replace with the kennel's real WhatsApp number before launch.

const form = document.querySelector('#enquiry-form');
const note = document.querySelector('#form-note');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  const interest = String(data.get('interest') || '').trim();
  const message = String(data.get('message') || '').trim();

  const text = [
    'Hello Bellissimo Geni, I would like to enquire about a Cane Corso.',
    '',
    `Name: ${name}`,
    `Phone / WhatsApp: ${phone}`,
    `Looking for: ${interest}`,
    `Message: ${message || 'Please send me current availability and pricing.'}`
  ].join('\n');

  if (WHATSAPP_NUMBER === '2348000000000') {
    note.textContent = 'Demo mode: replace WHATSAPP_NUMBER in app.js with the real business number before launch.';
    note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
});

// Prevent accidental jumps for placeholder links and add a small accessible focus treatment.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    document.body.classList.add('navigating');
    window.setTimeout(() => document.body.classList.remove('navigating'), 500);
  });
});