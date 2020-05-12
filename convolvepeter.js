// Wrap everything in an immediately invoked function to protect our scope.
(async () => {
  let audioContext = new (window.AudioContext || window.webkitAudioContext)();
  reverbjs.extend(audioContext);
  let selected_impulse = -1;
  let selected_source = -1;
  let recording = false;
  let recordingAudioBuffer = null; // type AudioBuffer
  let have_recording = false;
  let impulseNode = null;

  const impulses = [
    'http://nickdulworth.com/webaudio/impulses/impulse0.m4a',
    'http://reverbjs.org/Library/AbernyteGrainSilo.m4a',
    'http://nickdulworth.com/webaudio/impulses/impulse1.m4a',
    // 'http://nickdulworth.com/webaudio/impulses/impulse2.m4a',
  ];

  const sources = [
    'http://reverbjs.org/Library/SampleBachCMinorPrelude.m4a',
    'http://nickdulworth.com/webaudio/sources/clip.m4a',
    'http://nickdulworth.com/webaudio/sources/clarinet_solo.m4a',
  ];

  // Ask for mic access.
  try {
    const constraints = { audio: true, video: false };
    const micStream = await window.navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got mic.');
    initRecorder(micStream);
  } catch (err) {
    alert('Issue getting mic.', err);
  }

  /**
   * Append an AudioBuffer to another AudioBuffer
   */
  function appendBuffer(buffer1, buffer2) {
    var numberOfChannels = Math.min(buffer1.numberOfChannels, buffer2.numberOfChannels);
    var tmp = audioContext.createBuffer(
      numberOfChannels,
      buffer1.length + buffer2.length,
      buffer1.sampleRate
    );
    for (var i = 0; i < numberOfChannels; i++) {
      var channel = tmp.getChannelData(i);
      channel.set(buffer1.getChannelData(i), 0);
      channel.set(buffer2.getChannelData(i), buffer1.length);
    }
    return tmp;
  }

  function initRecorder(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    reverbjs.extend(audioContext);
    const streamSourceNode = audioContext.createMediaStreamSource(stream);
    const recorder = audioContext.createScriptProcessor(1024, 1, 1);

    // Send the mic data to the recorder.
    streamSourceNode.connect(recorder);
    recorder.connect(audioContext.destination);

    // Tell the recorder to call the "handleRecvAudio" fn every time it is sent audio from the mic.
    recorder.onaudioprocess = handleRecvAudio;
  }

  /**
   * Process audio from the mic. i.e. save it to a buffer.
   */
  function handleRecvAudio(e) {
    if (recording) {
      if (!recordingAudioBuffer) {
        recordingAudioBuffer = e.inputBuffer;
      } else {
        recordingAudioBuffer = appendBuffer(recordingAudioBuffer, e.inputBuffer);
      }
    }
  }

  function startRecording() {
    recordingAudioBuffer = null;
    recording = true;
  }

  function stopRecording() {
    have_recording = true;
    recording = false;
    return;
  }

  /**
   * Connect the given source to the impulse and the impulse to the audio output.
   * End up with: source -> impulse -> audio output.
   */
  function convolveImpulseAndSource(impulseUrl, sourceUrl) {
    // Load the impulse response; upon load, connect it to the audio output.
    const impulseNode = audioContext.createReverbFromUrl(impulseUrl, function() {
      impulseNode.connect(audioContext.destination);
    });

    // Load a test sound; upon load, connect it to the reverb node.
    const sourceNode = audioContext.createSourceFromUrl(sourceUrl, function() {
      sourceNode.connect(impulseNode);
    });

    return [sourceNode, impulseNode];
  }

  function convolveImpulseAndRecording(impulseUrl, recordingNode) {
    // Load the impulse response; upon load, connect it to the audio output.
    const impulseNode = audioContext.createReverbFromUrl(impulseUrl, function() {
      impulseNode.connect(audioContext.destination);
    });

    recordingNode.connect(impulseNode);

    return [recordingNode, impulseNode];
  }

  /**
   * Create an AudioBufferSourceNode from and AudioBuffer so that we can play it and/or convolve it.
   */
  function createPlayableRecording() {
    let recordingNode = audioContext.createBufferSource();
    recordingNode.buffer = recordingAudioBuffer;
    return recordingNode;
  }

  function handlePlayRecording() {
    if (!have_recording) {
      return alert('Must record something first.');
    }
    let recordingNode = createPlayableRecording();
    // Connect it to the audio output so we can play it.
    recordingNode.connect(audioContext.destination);
    // Play it.
    audioContext.resume();
    recordingNode.start();
  }

  function handleToggleRecording() {
    if (!recording) {
      console.log('Start recording!');
      document.getElementById('record').innerHTML = 'Stop Recording';
      startRecording();
    } else {
      console.log('Stop recording!');
      document.getElementById('record').innerHTML = '<i class="fas fa-microphone"></i>&nbsp;Record';
      stopRecording();
    }
  }

  function handleConvolve() {
    if (selected_source == -1 || selected_impulse == -1) {
      return alert('Must select source and impulse.');
    }

    if (selected_source == 0 && !have_recording) {
      return alert("You selected record but didn't record anything");
    }

    // Pause and clear anything we are currently playing.
    audioContext.suspend();
    if (impulseNode) {
      impulseNode.disconnect(audioContext.destination);
    }

    let convolvedNode = null;

    // If we selected a preset source.
    if (selected_source > 0) {
      [convolvedNode, impulseNode] = convolveImpulseAndSource(
        impulses[selected_impulse],
        sources[selected_source]
      );
    }

    // If we selected to use our recording.
    else {
      let recordingNode = createPlayableRecording();
      [convolvedNode, impulseNode] = convolveImpulseAndRecording(
        impulses[selected_impulse],
        recordingNode
      );
    }

    convolvedNode.start();
    audioContext.resume();
  }

  function selectImpulse(impulse) {
    selected_impulse = impulse;
    document.getElementById('impulse-0').classList.remove('Card__selected');
    document.getElementById('impulse-1').classList.remove('Card__selected');
    document.getElementById('impulse-2').classList.remove('Card__selected');
    document.getElementById('impulse-' + impulse).classList.add('Card__selected');
  }

  function selectSource(source) {
    selected_source = source;
    document.getElementById('source-0').classList.remove('Card__selected');
    document.getElementById('source-1').classList.remove('Card__selected');
    document.getElementById('source-2').classList.remove('Card__selected');
    document.getElementById('source-' + source).classList.add('Card__selected');
  }

  document.getElementById('play-recording-btn').onclick = handlePlayRecording;
  document.getElementById('convolve-btn').onclick = handleConvolve;
  document.getElementById('record').onclick = handleToggleRecording;
  document.getElementById('impulse-0').onclick = () => selectImpulse(0);
  document.getElementById('impulse-1').onclick = () => selectImpulse(1);
  document.getElementById('impulse-2').onclick = () => selectImpulse(2);
  document.getElementById('source-0').onclick = () => selectSource(0);
  document.getElementById('source-1').onclick = () => selectSource(1);
  document.getElementById('source-2').onclick = () => selectSource(2);
})();
