const form = document.querySelector('#enquiry-form');
const note = document.querySelector('#form-note');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (String(data.get('website') || '').trim()) return;
  const name = String(data.get('name') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  const interest = String(data.get('interest') || '').trim();
  const message = String(data.get('message') || '').trim();

  if (!window.BG?.validPhone(phone)) {
    note.textContent = 'Please enter a valid phone/WhatsApp number (7–15 digits).';
    note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  BG.track?.('contact_submit', interest);

  const text = [
    'Hello Bellissimo Geni, I would like to enquire about a Cane Corso.',
    '',
    `Name: ${name}`,
    `Phone / WhatsApp: ${phone}`,
    `Looking for: ${interest}`,
    `Message: ${message || 'Please send me current availability and pricing.'}`
  ].join('\n');

  window.open(BG.whatsappMessage(text), '_blank', 'noopener,noreferrer');
  note.textContent = 'WhatsApp opened with your enquiry.';
});

// Prevent accidental jumps for placeholder links and add a small accessible focus treatment.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    document.body.classList.add('navigating');
    window.setTimeout(() => document.body.classList.remove('navigating'), 500);
  });
});