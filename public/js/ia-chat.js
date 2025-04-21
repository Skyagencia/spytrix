const messages = [
    "Analisando os dados...",
    "Detectamos atividades suspeitas."
    // As mensagens da LGPD e pagamento serão adicionadas após as perguntas ou se o usuário escolher continuar.
  ];
  
  let index = 0;
  let questionCount = 0;
  
  function showMessage() {
    if (index < messages.length) {
      const chatBox = document.getElementById('chat-box');
      const message = document.createElement('p');
      message.textContent = messages[index];
      message.classList.add('chat-msg');
      chatBox.appendChild(message);
      chatBox.scrollTop = chatBox.scrollHeight;
  
      if (messages[index] === "Detectamos atividades suspeitas.") {
        document.getElementById('question-options').style.display = 'block';
      } else {
        index++;
        setTimeout(showMessage, 2500); // Delay entre msgs
      }
    }
  }
  
  function startQuestions() {
    document.getElementById('question-options').style.display = 'none';
    document.getElementById('question-input').style.display = 'block';
  }
  
  function skipQuestions() {
    document.getElementById('question-options').style.display = 'none';
    continueFlow();
  }
  
  function submitQuestion() {
    const userInput = document.getElementById('user-question');
    const question = userInput.value.trim();
    if (question === "") return;
  
    const chatBox = document.getElementById('chat-box');
    const userMessage = document.createElement('p');
    userMessage.textContent = question;
    userMessage.classList.add('chat-msg', 'user');
    chatBox.appendChild(userMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
  
    // Simula a resposta da IA
    const aiResponse = document.createElement('p');
    aiResponse.textContent = "Resposta da IA para: " + question;
    aiResponse.classList.add('chat-msg');
    chatBox.appendChild(aiResponse);
    chatBox.scrollTop = chatBox.scrollHeight;
  
    userInput.value = "";
    questionCount++;
  
    if (questionCount >= 3) {
      document.getElementById('question-input').style.display = 'none';
      continueFlow();
    }
  }
  
  function continueFlow() {
    const additionalMessages = [
      "Devido à LGPD (Lei nº 13.709/2018), não podemos exibir as provas diretamente aqui.",
      "Podemos enviar todas as provas por WhatsApp. Por favor, informe o número da pessoa investigada.",
      "Para manter nossos servidores, cobramos uma taxa simbólica de R$19,00.",
      "Gerando QR Code Pix para pagamento..."
    ];
  
    let i = 0;
    function showAdditionalMessage() {
      if (i < additionalMessages.length) {
        const chatBox = document.getElementById('chat-box');
        const message = document.createElement('p');
        message.textContent = additionalMessages[i];
        message.classList.add('chat-msg');
        chatBox.appendChild(message);
        chatBox.scrollTop = chatBox.scrollHeight;
        i++;
        setTimeout(showAdditionalMessage, 2500);
      }
    }
    showAdditionalMessage();
  }
  
  window.onload = showMessage;
  