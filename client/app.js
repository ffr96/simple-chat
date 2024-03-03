let counter = 0;

function addMsg (msg, messages) {
  const item = document.createElement('li');
  item.textContent = msg;
  return messages.appendChild(item);
}

function scrollToTop () {
  return window.scrollTo(0, document.body.scrollHeight);
}

window.addEventListener('DOMContentLoaded', () => {
    const socket = io({
      auth: {
        serverOffset: 0
      },
      ackTimeout: 10000,
      retries: 3
    });
      
    const form = document.getElementById('form');
    const input = document.getElementById('input');
    const messages = document.getElementById('messages');
    
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
    
    const toggleButton = document.getElementById('toggle-btn');
    
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
})

