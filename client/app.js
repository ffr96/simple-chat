let counter = 0;

function addMsg (msg, messages) {
  const item = document.createElement('li');
  item.textContent = msg;
  return messages.appendChild(item);
}

function scrollToTop () {
  return window.scrollTo(0, document.body.scrollHeight);
}

function startChat (username) {
  const socket = io({
    auth: {
      serverOffset: 0,
      username
    },
    ackTimeout: 10000,
    retries: 3
  });
    
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const messages = document.getElementById('messages');
  const toggleButton = document.getElementById('toggle-btn');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
      const clientOffset = `${socket.id}-${counter++}`;
      socket.emit('chat message', input.value, clientOffset);
      input.value = '';
    }
  });
  
  socket.on('user join', (msg, id) => {
    if (socket.id !== id) addMsg(msg, messages);
  });

  socket.on('user leave', (msg) => {
    addMsg(msg, messages);
  })
  
  socket.on('chat message', (msg, serverOffset) => {
    addMsg(msg, messages);
    scrollToTop();
    socket.auth.serverOffset = serverOffset;
  });
  
  toggleButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (socket.connected) {
      toggleButton.innerText = 'Connect';
      socket.disconnect();
    } else {
      toggleButton.innerText = 'Disconnect';
      socket.connect();
    }
  });
};

window.addEventListener('DOMContentLoaded', () => {

  const usernameDialog = document.querySelector('.username-dialog');
  const usernameForm = document.getElementById('username-form');
  const usernameInput = document.getElementById('username');

  usernameForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (usernameInput.value) {
      startChat(usernameInput.value);
      usernameDialog.remove();
    }
  });
})

