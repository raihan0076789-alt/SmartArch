// ============================================================
  //  ARCHITECT STUDIO — Main JS (Fixed & Enhanced)
  //  Fixes: drag/drop doors+windows, 3D floor alignment,
  //         Ollama AI chat, backend integration
  // ============================================================

  const AI_BACKEND_URL  = 'http://localhost:3001';  // kept for non-guarded routes (floorplan image upload)
  const MAIN_API_URL    = 'http://localhost:5000';   // proxied AI routes (with plan guard)

  let projectId = null, projectData = null;
  // Always expose projectData on window so templates.js can access it
  Object.defineProperty(window, 'projectData', {
    get(){ return projectData; },
    set(v){ projectData = v; },
    configurable: true
  });
  let currentTool = 'select', currentView = '2d';
  let zoomLevel = 1, selectedRoom = null;
  let isDragging = false, dragStart = { x: 0, y: 0 };
  let isResizing = false, resizeHandle = null;
  let snapSize = 1;
  let activeFloorIdx = 0;
  let isDraggingElement = null;
  let dragElementStart = null;

  const STYLES = {
    modern:      { label: 'Modern',      desc: 'Sleek concrete & glass with bold geometry', wallColor: 0x2c3e50, floorColor: 0x95a5a6, roofColor: 0x1a252f, groundColor: 0x2c3e50, ambientInt: 0.5, skyColor: 0x1a1a2e },
    minimalist:  { label: 'Minimalist',  desc: 'Pure whites, natural light, clean lines',   wallColor: 0xf5f5f5, floorColor: 0xe8e8e8, roofColor: 0xcccccc, groundColor: 0xdce0e6, ambientInt: 0.7, skyColor: 0xeef2f7 },
    traditional: { label: 'Traditional', desc: 'Warm brick, oak floors, classic charm',      wallColor: 0xd4a574, floorColor: 0x8b6f47, roofColor: 0x7b3f00, groundColor: 0x4a7c59, ambientInt: 0.55, skyColor: 0x87ceeb },
    luxury:      { label: 'Luxury',      desc: 'Marble, gold accents, opulent grandeur',     wallColor: 0x1a1a1a, floorColor: 0xc0b090, roofColor: 0x0d0d0d, groundColor: 0x2d2d2d, ambientInt: 0.4, skyColor: 0x0d0d1a }
  };
  const ROOM_COLORS = {
    living:    { bg: 'rgba(91,124,250,0.3)',   border: '#5b7cfa', hex: 0x5b7cfa, dot: '#5b7cfa' },
    bedroom:   { bg: 'rgba(56,239,125,0.25)',  border: '#38ef7d', hex: 0x38ef7d, dot: '#38ef7d' },
    bathroom:  { bg: 'rgba(86,204,242,0.3)',   border: '#56ccf2', hex: 0x56ccf2, dot: '#56ccf2' },
    kitchen:   { bg: 'rgba(255,193,7,0.3)',    border: '#ffc107', hex: 0xffc107, dot: '#ffc107' },
    dining:    { bg: 'rgba(156,136,255,0.3)',  border: '#9c88ff', hex: 0x9c88ff, dot: '#9c88ff' },
    office:    { bg: 'rgba(116,185,255,0.3)',  border: '#74b9ff', hex: 0x74b9ff, dot: '#74b9ff' },
    garage:    { bg: 'rgba(130,140,155,0.3)',  border: '#828c9b', hex: 0x828c9b, dot: '#828c9b' },
    staircase: { bg: 'rgba(255,150,50,0.28)',  border: '#ff9632', hex: 0xff9632, dot: '#ff9632' },
    balcony:   { bg: 'rgba(100,200,255,0.25)', border: '#64c8ff', hex: 0x64c8ff, dot: '#64c8ff' },
    hallway:   { bg: 'rgba(210,185,140,0.28)', border: '#c8a96e', hex: 0xc8a96e, dot: '#c8a96e' },
    entrance:  { bg: 'rgba(212,169,110,0.28)', border: '#d4a96e', hex: 0xd4a96e, dot: '#d4a96e' },
    lift:      { bg: 'rgba(86,204,242,0.18)',  border: '#56ccf2', hex: 0x56ccf2, dot: '#00d4ff' },
    other:     { bg: 'rgba(180,180,180,0.25)', border: '#aaa',    hex: 0xaaaaaa, dot: '#aaa'    }
  };

  // Cost per m² (USD) by room type — used for real-time per-room cost estimation
  const ROOM_RATES = {
    living:    1800,
    bedroom:   1600,
    bathroom:  2800,
    kitchen:   3200,
    dining:    1700,
    office:    1900,
    garage:     900,
    staircase: 1400,
    balcony:   1200,
    hallway:   1100,
    entrance:  1600,
    lift:      3500,
    other:     1500
  };
  function getRoomRate(type){ return ROOM_RATES[type] || ROOM_RATES.other; }

  function snap(val) { const e = document.getElementById('snapEnabled'); return e && e.checked ? Math.round(val/snapSize)*snapSize : val; }
  function updateSnapSize() { snapSize = parseFloat(document.getElementById('snapSize').value)||1; }
  function el(id) { return document.getElementById(id); }

  function showToast(msg, type='info') {
    let c = el('toastContainer'); if (!c) { c=document.createElement('div'); c.id='toastContainer'; c.className='toast-container'; document.body.appendChild(c); }
    const t=document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML=`<i class="fas fa-${type==='success'?'check':type==='error'?'times':'info-circle'}"></i> ${msg}`;
    c.appendChild(t); setTimeout(()=>t.remove(),3500);
  }
  function showLoading(msg='Loading...') {
    let o=el('loadingOverlay');
    if(!o){o=document.createElement('div');o.id='loadingOverlay';o.className='loading-overlay';o.innerHTML=`<div class="loading-content"><div class="loading-spinner"></div><div id="loadingMsg">${msg}</div></div>`;document.body.appendChild(o);}
    else{const m=o.querySelector('#loadingMsg');if(m)m.textContent=msg;o.style.display='flex';}
  }
  function hideLoading(){const o=el('loadingOverlay');if(o)o.style.display='none';}

  document.addEventListener('DOMContentLoaded',()=>{
    if(typeof requireAuth==='function'&&!requireAuth())return;
    _refreshUserPlan(); // sync plan from server so guards use fresh data
    const p=new URLSearchParams(window.location.search);
    projectId=p.get('id');
    if(projectId) loadProject(); else initNewProject();
    setupCanvas(); setupEventListeners(); initOllamaChat();

    // ── Client-connection context banner ──────────────────────────────────────
    // When the workspace is opened via "Open Workspace" from a client connection,
    // the URL contains connectionId / clientName / projectName.
    // We surface these in a non-intrusive banner in the navbar.
    _initClientContextBanner(p);
  });

  /**
   * Reads client-connection query params and populates the context banner.
   * Safe to call even when params are absent — banner stays hidden.
   */
  function _initClientContextBanner(params) {
    const connectionId      = params.get('connectionId');
    const clientName        = params.get('clientName');
    // projectName   = used when opening a blank workspace (no existing project)
    // clientProjectName = used when opening an existing architect project via Open Workspace
    const projectName       = params.get('projectName');
    const clientProjectName = params.get('clientProjectName');
    // The label to show in the banner — prefer clientProjectName, fall back to projectName
    const briefLabel        = clientProjectName || projectName || 'Client Brief';

    if (!connectionId) return;   // not opened from a connection — nothing to do

    const banner = document.getElementById('clientContextBanner');
    const nameEl = document.getElementById('ccbClientName');
    const projEl = document.getElementById('ccbProjectName');

    if (!banner) return;

    if (nameEl) nameEl.textContent = clientName || 'Client';
    if (projEl) projEl.textContent = briefLabel;

    banner.classList.add('visible');

    // Store on window so other code (e.g. save flow) can reference it if needed
    const additionalProjectId = params.get('additionalProjectId') || null;
    window._clientConnectionContext = { connectionId, clientName, projectName: briefLabel, additionalProjectId };

    // ── Case 1: blank workspace (no ?id=) — pre-fill title from client brief name ──
    if (!params.get('id') && projectName) {
      const titleInput = document.getElementById('projectTitle');
      if (titleInput) {
        titleInput.value = projectName;
        if (typeof projectData !== 'undefined' && projectData) {
          projectData.name = projectName;
        }
      }
    }

    // ── Case 2: existing architect project loaded via ?id= ──────────────────────
    // After loadProject() finishes, the title input already has the architect's
    // saved project name. We additionally store the client's brief label so the
    // banner shows it — no title override needed (architect keeps their own name).
    // But if the architect wants the client's name to appear in the title field too,
    // we update it only when the project name is still generic ('Untitled Project').
    if (params.get('id') && clientProjectName) {
      // Wait for loadProject() to finish before checking
      const waitAndMaybeSetTitle = () => {
        const titleInput = document.getElementById('projectTitle');
        if (!titleInput) return;
        const currentName = (titleInput.value || '').trim();
        // Only auto-fill if the project has no meaningful name yet
        if (!currentName || currentName === 'Untitled Project' || currentName === 'Untitled') {
          titleInput.value = clientProjectName;
          if (typeof projectData !== 'undefined' && projectData) {
            projectData.name = clientProjectName;
          }
        }
      };
      // Poll until loadProject sets the title (it's async)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const titleInput = document.getElementById('projectTitle');
        // loadProject sets projectData — wait for it
        if ((typeof projectData !== 'undefined' && projectData && projectData._id) || attempts > 40) {
          clearInterval(poll);
          waitAndMaybeSetTitle();
        }
      }, 100);
    }
  }

  async function loadProject(){
    try{
      showLoading('Loading project...');
      const data=await api.getProject(projectId); projectData=data.data;
      el('projectTitle').value=projectData.name||'Untitled';
      el('totalWidth').value=projectData.totalWidth;
      el('totalDepth').value=projectData.totalDepth;
      el('numFloors').value=projectData.floors.length;
      el('floorHeight').value=projectData.floors[0]?.height||2.7;
      if(el('roofType'))el('roofType').value=projectData.specifications?.roofType||'pitched';
      if(projectData.style)setStyle(projectData.style,false);
      projectData.floors.forEach(f=>f.rooms.forEach(r=>{if(!r.doors)r.doors=[];if(!r.windows)r.windows=[];}));
      if(projectData.budget&&el('budgetCapInput'))el('budgetCapInput').value=projectData.budget/1000;
      updateFloorTabs();renderRooms();updateInfoPanel();drawFloorPlan();hideLoading();
      if(typeof initReviewsPanel==='function') initReviewsPanel(projectId);
    }catch(e){hideLoading();showToast('Failed to load project','error');initNewProject();}
  }

  function initNewProject(){
    projectData={name:'Untitled Project',totalWidth:20,totalDepth:15,type:'residential',style:'modern',
      specifications:{roofType:'pitched'},
      floors:[{level:1,name:'Ground Floor',height:2.7,rooms:[]}],
      materials:{exterior:{walls:'concrete',roof:'metal',foundation:'concrete'},interior:{flooring:'hardwood',ceilings:'drywall'}}};
    updateFloorTabs();renderRooms();updateInfoPanel();drawFloorPlan();
    setTimeout(pushUndoState,200);
  }

  function setupCanvas(){
    const canvas=el('floorplanCanvas'),container=el('canvasContainer');
    canvas.width=container.clientWidth;canvas.height=container.clientHeight;
    window.addEventListener('resize',()=>{canvas.width=container.clientWidth;canvas.height=container.clientHeight;drawFloorPlan();});
    // Continuous animation loop for lift shimmer (only redraws when 2D view is active and a lift exists)
    let _liftAnimId=null;
    function _liftAnimLoop(){
      _liftAnimId=requestAnimationFrame(_liftAnimLoop);
      if(currentView==='2d'&&projectData&&projectData.floors.some(f=>f.rooms.some(r=>r.type==='lift'))){
        drawFloorPlan();
      }
    }
    _liftAnimLoop();
  }

  function setupEventListeners(){
    const canvas=el('floorplanCanvas');
    canvas.addEventListener('mousedown',handleMouseDown);
    canvas.addEventListener('mousemove',handleMouseMove);
    canvas.addEventListener('mouseup',handleMouseUp);
    canvas.addEventListener('mouseleave',handleMouseUp);
    canvas.addEventListener('wheel',(e)=>{e.preventDefault();const d=e.deltaY>0?-0.1:0.1;zoomLevel=Math.max(0.2,Math.min(4,zoomLevel+d));el('zoomLevel').textContent=Math.round(zoomLevel*100)+'%';drawFloorPlan();},{passive:false});
    document.addEventListener('keydown',(e)=>{
      if(e.key==='Escape'){isPlacingDoor=false;setTool('select');drawFloorPlan();}
      if((e.key==='Delete'||e.key==='Backspace')&&selectedRoom&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='SELECT')deleteRoom(selectedRoom);
      if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveProject();}
      if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo();}
      if(e.ctrlKey&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){e.preventDefault();redo();}
      if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='SELECT')return;
      if(e.key==='v'||e.key==='V')setTool('select');
      if(e.key==='r'||e.key==='R')setTool('room');
      if(e.key==='d'||e.key==='D')setTool('door');
      if(e.key==='w'||e.key==='W')setTool('window');
      if(e.key==='s'||e.key==='S')setTool('staircase');
      if(e.key==='m'||e.key==='M')setTool('measure');
    });
  }

  function getScale(){const canvas=el('floorplanCanvas'),padding=70;const sx=(canvas.width-padding*2)/projectData.totalWidth;const sy=(canvas.height-padding*2)/projectData.totalDepth;return Math.min(sx,sy)*zoomLevel;}
  function getOffset(){const canvas=el('floorplanCanvas'),scale=getScale();return{x:(canvas.width-projectData.totalWidth*scale)/2,y:(canvas.height-projectData.totalDepth*scale)/2};}
  function toWorld(px,py){const scale=getScale(),off=getOffset();return{x:(px-off.x)/scale,y:(py-off.y)/scale};}
  function toCanvas(wx,wy){const scale=getScale(),off=getOffset();return{x:off.x+wx*scale,y:off.y+wy*scale};}

  const HANDLE_SIZE=7;
  function getHandleAt(mx,my){
    if(!selectedRoom)return null;
    const scale=getScale(),off=getOffset(),room=selectedRoom;
    const rx=off.x+room.x*scale,ry=off.y+room.z*scale,rw=room.width*scale,rh=room.depth*scale;
    const handles={nw:[rx,ry],n:[rx+rw/2,ry],ne:[rx+rw,ry],w:[rx,ry+rh/2],e:[rx+rw,ry+rh/2],sw:[rx,ry+rh],s:[rx+rw/2,ry+rh],se:[rx+rw,ry+rh]};
    for(const[name,[hx,hy]]of Object.entries(handles)){if(Math.abs(mx-hx)<=HANDLE_SIZE+2&&Math.abs(my-hy)<=HANDLE_SIZE+2)return name;}
    return null;
  }

  function getDoorWindowCanvasPos(room,element,scale,off){
    const rx=off.x+room.x*scale,ry=off.y+room.z*scale,rw=room.width*scale,rh=room.depth*scale;
    const pos=element.pos??0.5;
    switch(element.wall){
      case'top':    return{cx:rx+pos*rw,cy:ry};
      case'bottom': return{cx:rx+pos*rw,cy:ry+rh};
      case'left':   return{cx:rx,cy:ry+pos*rh};
      case'right':  return{cx:rx+rw,cy:ry+pos*rh};
      default:      return{cx:rx+rw/2,cy:ry};
    }
  }

  function getDoorWindowAt(mx,my){
    const floor=projectData.floors[activeFloorIdx];if(!floor)return null;
    const scale=getScale(),off=getOffset();
    for(let ri=0;ri<floor.rooms.length;ri++){
      const room=floor.rooms[ri];
      for(let di=0;di<(room.doors||[]).length;di++){
        const{cx,cy}=getDoorWindowCanvasPos(room,room.doors[di],scale,off);
        if(Math.abs(mx-cx)<=12&&Math.abs(my-cy)<=12)return{type:'door',roomIdx:ri,elIdx:di,element:room.doors[di]};
      }
      for(let wi=0;wi<(room.windows||[]).length;wi++){
        const{cx,cy}=getDoorWindowCanvasPos(room,room.windows[wi],scale,off);
        if(Math.abs(mx-cx)<=12&&Math.abs(my-cy)<=12)return{type:'window',roomIdx:ri,elIdx:wi,element:room.windows[wi]};
      }
    }
    return null;
  }

  // ── Measure tool state ───────────────────────────────────────
  let _measureStart=null,_measureEnd=null,_measureActive=false,_measureComplete=false;
  // ── Compass state ────────────────────────────────────────────
  let _compassAngle=0;
  const _COMPASS_DIRS=['N','E','S','W'];

  function _rotateFloorPlan90(){
    if(!projectData)return;
    const W=projectData.totalWidth, D=projectData.totalDepth;
    projectData.floors.forEach(floor=>{
      floor.rooms.forEach(room=>{
        const oldX=room.x, oldZ=room.z, oldW=room.width, oldD=room.depth;
        room.x     = oldZ;
        room.z     = W - oldX - oldW;
        room.width  = oldD;
        room.depth  = oldW;
      });
    });
    projectData.totalWidth = D;
    projectData.totalDepth = W;
    if(el('totalWidth'))el('totalWidth').value=D;
    if(el('totalDepth'))el('totalDepth').value=W;
    selectedRoom=null;
    renderRooms();hideRoomProperties();updateInfoPanel();markUnsaved();
  }

  function handleMouseDown(e){
    if(currentView!=='2d')return;
    const rect=e.target.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    // ── Compass click ─────────────────────────────────────────
    const _cc=el('floorplanCanvas');
    const _ccx=_cc.width-40,_ccy=_cc.height-40;
    if(Math.sqrt((mx-_ccx)**2+(my-_ccy)**2)<=22){
      _compassAngle=(_compassAngle+90)%360;
      _rotateFloorPlan90();
      showToast(`North → ${_COMPASS_DIRS[_compassAngle/90]} (${_compassAngle}°)`,'info');
      drawFloorPlan();return;
    }
    if(currentTool==='measure'){
      if(_measureComplete){
        // A completed measurement is on screen — next click starts a fresh one
        _measureStart=toWorld(mx,my);_measureEnd=null;_measureActive=true;_measureComplete=false;
      } else if(!_measureActive||!_measureStart){
        _measureStart=toWorld(mx,my);_measureEnd=null;_measureActive=true;_measureComplete=false;
      } else {
        _measureEnd=toWorld(mx,my);_measureActive=false;_measureComplete=true;
        const dx=_measureEnd.x-_measureStart.x,dy=_measureEnd.y-_measureStart.y;
        const dist=Math.sqrt(dx*dx+dy*dy).toFixed(2);
        showToast(`Distance: ${dist} m`,'info');
        drawFloorPlan();
      }
      return;
    }
    if(currentTool==='select'){
      const handle=getHandleAt(mx,my);
      if(handle){isResizing=true;resizeHandle=handle;dragStart={x:mx,y:my,origRoom:{...selectedRoom}};return;}
      const dwHit=getDoorWindowAt(mx,my);
      if(dwHit){isDraggingElement=dwHit;dragElementStart={x:mx,y:my};return;}
      const room=getRoomAt(mx,my);
      if(room){selectedRoom=room;renderRooms();showRoomProperties(room);isDragging=true;dragStart={x:mx,y:my};}
      else{selectedRoom=null;renderRooms();hideRoomProperties();}
      drawFloorPlan();
    }else if(currentTool==='room'){addRoomAt(mx,my);}
    else if(currentTool==='staircase'){placeStaircaseAt(mx,my);}
    else if(currentTool==='door'){placeDoorOrWindow('door',mx,my);}
    else if(currentTool==='window'){placeDoorOrWindow('window',mx,my);}
  }

  function placeDoorOrWindow(type,mx,my){
    const floor=projectData.floors[activeFloorIdx];if(!floor)return;
    const w=toWorld(mx,my);
    for(const room of floor.rooms){
      const rx=room.x,ry=room.z,rw=room.width,rd=room.depth;
      const margin=0.5;
      let wall=null,pos=0;
      if(Math.abs(w.y-ry)<margin&&w.x>=rx&&w.x<=rx+rw){wall='top';pos=(w.x-rx)/rw;}
      else if(Math.abs(w.y-(ry+rd))<margin&&w.x>=rx&&w.x<=rx+rw){wall='bottom';pos=(w.x-rx)/rw;}
      else if(Math.abs(w.x-rx)<margin&&w.y>=ry&&w.y<=ry+rd){wall='left';pos=(w.y-ry)/rd;}
      else if(Math.abs(w.x-(rx+rw))<margin&&w.y>=ry&&w.y<=ry+rd){wall='right';pos=(w.y-ry)/rd;}
      if(wall){
        if(!room.doors)room.doors=[];if(!room.windows)room.windows=[];
        const element={wall,pos:Math.max(0.1,Math.min(0.9,pos)),width:type==='door'?0.9:1.0};
        if(type==='door')room.doors.push(element);else room.windows.push(element);
        drawFloorPlan();showToast(`${type} placed on ${wall} wall`,'success');markUnsaved();return;
      }
    }
    showToast('Click near a room wall to place '+type,'info');
  }

  function handleMouseMove(e){
    if(currentView!=='2d')return;
    const rect=e.target.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const canvas=el('floorplanCanvas');
    // ── Compass hover ─────────────────────────────────────────
    const _ccx=canvas.width-40,_ccy=canvas.height-40;
    const _over=Math.sqrt((mx-_ccx)**2+(my-_ccy)**2)<=22;
    if(_over!==window._compassHover){window._compassHover=_over;canvas.style.cursor=_over?'pointer':'';drawFloorPlan();}
    if(_over)return;
    // Live measure preview (only while actively placing second point)
    if(currentTool==='measure'&&_measureActive&&!_measureComplete&&_measureStart){
      _measureEnd=toWorld(mx,my);drawFloorPlan();return;
    }
    if(isDraggingElement){
      const floor=projectData.floors[activeFloorIdx];
      const{type,roomIdx,elIdx}=isDraggingElement;
      const room=floor.rooms[roomIdx];
      const element=type==='door'?room.doors[elIdx]:room.windows[elIdx];
      const w=toWorld(mx,my);
      let newPos=element.pos;
      if(element.wall==='top'||element.wall==='bottom')newPos=Math.max(0.05,Math.min(0.95,(w.x-room.x)/room.width));
      else newPos=Math.max(0.05,Math.min(0.95,(w.y-room.z)/room.depth));
      element.pos=newPos;drawFloorPlan();markUnsaved();return;
    }
    if(isResizing&&selectedRoom&&resizeHandle){
      const scale=getScale(),orig=dragStart.origRoom;
      const dx=(mx-dragStart.x)/scale,dy=(my-dragStart.y)/scale;
      const minSize=1.5;
      const minW=(selectedRoom.type==='garage')?6:minSize;
      const minD=(selectedRoom.type==='garage')?6:minSize;
      let{x,z,width,depth}=orig;
      if(resizeHandle.includes('e'))width=Math.max(minW,snap(orig.width+dx));
      if(resizeHandle.includes('s'))depth=Math.max(minD,snap(orig.depth+dy));
      if(resizeHandle.includes('w')){const nw=Math.max(minW,snap(orig.width-dx));x=snap(orig.x+(orig.width-nw));width=nw;}
      if(resizeHandle.includes('n')){const nd=Math.max(minD,snap(orig.depth-dy));z=snap(orig.z+(orig.depth-nd));depth=nd;}
      x=Math.max(0,Math.min(projectData.totalWidth-width,x));z=Math.max(0,Math.min(projectData.totalDepth-depth,z));
     // Only apply resize if it doesn't overlap another room (staircases can overlap non-staircases)
      const resizeOk=selectedRoom.type==='staircase'
        ?!getOverlappingRooms(x,z,width,depth,selectedRoom).filter(r=>r.type==='staircase').length
        :!getOverlappingRooms(x,z,width,depth,selectedRoom).length;
      if(resizeOk){
        selectedRoom.x=x;selectedRoom.z=z;selectedRoom.width=width;selectedRoom.depth=depth;
      }
      drawFloorPlan();showRoomProperties(selectedRoom);updateInfoPanel();markUnsaved();
    }else if(isDragging&&selectedRoom){
      const scale=getScale();
      const dx=(mx-dragStart.x)/scale,dz=(my-dragStart.y)/scale;
      const nx=Math.max(0,Math.min(projectData.totalWidth-selectedRoom.width,snap(selectedRoom.x+dx)));
      const nz=Math.max(0,Math.min(projectData.totalDepth-selectedRoom.depth,snap(selectedRoom.z+dz)));
      // Try full move first; if blocked try axis-by-axis (slide along walls)
    if(selectedRoom.type==='staircase'){
        const stairConflicts=getOverlappingRooms(nx,nz,selectedRoom.width,selectedRoom.depth,selectedRoom).filter(r=>r.type==='staircase');
        if(!stairConflicts.length){selectedRoom.x=nx;selectedRoom.z=nz;}
      } else if(!getOverlappingRooms(nx,nz,selectedRoom.width,selectedRoom.depth,selectedRoom).length){
        selectedRoom.x=nx;selectedRoom.z=nz;
      } else if(!getOverlappingRooms(nx,selectedRoom.z,selectedRoom.width,selectedRoom.depth,selectedRoom).length){
        selectedRoom.x=nx; // slide horizontally only
      } else if(!getOverlappingRooms(selectedRoom.x,nz,selectedRoom.width,selectedRoom.depth,selectedRoom).length){
        selectedRoom.z=nz; // slide vertically only
      }
      dragStart={x:mx,y:my};drawFloorPlan();markUnsaved();
    }else{
      const handle=getHandleAt(mx,my);
      if(handle){const cm={nw:'nw-resize',n:'n-resize',ne:'ne-resize',w:'w-resize',e:'e-resize',sw:'sw-resize',s:'s-resize',se:'se-resize'};canvas.style.cursor=cm[handle]||'default';}
      else if(getDoorWindowAt(mx,my))canvas.style.cursor='grab';
      else canvas.style.cursor=currentTool==='select'?(getRoomAt(mx,my)?'grab':'default'):(currentTool==='door'||currentTool==='window'?'cell':'crosshair');
      if(currentTool==='door'||currentTool==='window'){drawFloorPlan();drawPlacementPreview(mx,my,currentTool);}
    }
  }

  function handleMouseUp(){
    if(isDragging){
      // Sync lift shaft position across all floors when a lift is moved
      if(selectedRoom&&selectedRoom.type==='lift'){
        const lx=selectedRoom.x,lz=selectedRoom.z;
        projectData.floors.forEach(f=>{f.rooms.forEach(r=>{if(r.type==='lift'&&r!==selectedRoom&&Math.abs(r._liftShaftX-selectedRoom._liftShaftX)<0.5){r.x=lx;r.z=lz;r._liftShaftX=lx;r._liftShaftZ=lz;}});});
        selectedRoom._liftShaftX=lx;selectedRoom._liftShaftZ=lz;
      }
      renderRooms();updateInfoPanel();
    }
    if(isResizing&&selectedRoom&&selectedRoom.type==='lift'){
      // Sync lift size across all floors when resized via drag handles
      const sx=selectedRoom._liftShaftX??selectedRoom.x;
      const sz=selectedRoom._liftShaftZ??selectedRoom.z;
      const lw=selectedRoom.width,ld=selectedRoom.depth;
      projectData.floors.forEach(f=>{
        f.rooms.forEach(r=>{
          if(r!==selectedRoom&&r.type==='lift'&&Math.abs((r._liftShaftX??r.x)-sx)<0.5&&Math.abs((r._liftShaftZ??r.z)-sz)<0.5){
            r.width=lw;r.depth=ld;
          }
        });
      });
    }
    isDragging=false;isResizing=false;resizeHandle=null;isDraggingElement=null;dragElementStart=null;
    if(selectedRoom)showRoomProperties(selectedRoom);
  }

  function getRoomAt(px,py){
    const w=toWorld(px,py),floor=projectData.floors[activeFloorIdx];if(!floor)return null;
    return[...floor.rooms].reverse().find(r=>w.x>=r.x&&w.x<=r.x+r.width&&w.y>=r.z&&w.y<=r.z+r.depth)||null;
  }

  function roomsOverlap(ax,az,aw,ad,bx,bz,bw,bd,gap){
    gap=gap||0;
    return ax<bx+bw+gap&&ax+aw>bx-gap&&az<bz+bd+gap&&az+ad>bz-gap;
  }

  function getOverlappingRooms(x,z,w,d,excludeRoom){
    const floor=projectData.floors[activeFloorIdx];if(!floor)return[];
    return floor.rooms.filter(r=>r!==excludeRoom&&roomsOverlap(x,z,w,d,r.x,r.z,r.width,r.depth,-0.05));
  }

  function flashOverlapRooms(conflicting){
    conflicting.forEach(r=>r._overlapFlash=true);
    drawFloorPlan();
    setTimeout(()=>{conflicting.forEach(r=>delete r._overlapFlash);drawFloorPlan();},1200);
  }

  function addRoomAt(px,py){
    const w=toWorld(px,py);
    const types=['living','bedroom','bathroom','kitchen','dining','office'];
    const type=types[Math.floor(Math.random()*types.length)];
    const rw=4,rd=4;
    const floor=projectData.floors[activeFloorIdx];

    const rx=snap(Math.max(0,Math.min(projectData.totalWidth-rw,w.x-rw/2)));
    const rz=snap(Math.max(0,Math.min(projectData.totalDepth-rd,w.y-rd/2)));

    // Check for overlaps at the clicked position
    const conflicts=getOverlappingRooms(rx,rz,rw,rd,null);
    if(conflicts.length){
      flashOverlapRooms(conflicts);
      showToast('⚠️ Room overlaps an existing room — choose a free area','error');
      return;
    }

    // Check canvas boundary
    if(rx+rw>projectData.totalWidth||rz+rd>projectData.totalDepth){
      showToast('⚠️ Room is outside the canvas boundary','error');
      return;
    }

    const room={name:type.charAt(0).toUpperCase()+type.slice(1),type,width:rw,depth:rd,
      x:rx,z:rz,height:floor?.height||2.7,doors:[],windows:[]};
    floor.rooms.push(room);
    pushUndoState();
    selectedRoom=room;renderRooms();showRoomProperties(room);updateInfoPanel();drawFloorPlan();markUnsaved();
  }

  function placeStaircaseAt(px,py){
    const w=toWorld(px,py);
    const floor=projectData.floors[activeFloorIdx];
    const floorH=floor.height||2.7;
    const stepCount=Math.max(8,Math.ceil(floorH/0.18));
    const stairDepth=Math.ceil(stepCount*0.28*2)/2;
    const stairWidth=1.5;
    const sx=snap(Math.max(0,Math.min(projectData.totalWidth-stairWidth,w.x-stairWidth/2)));
    const sz=snap(Math.max(0,Math.min(projectData.totalDepth-stairDepth,w.y-stairDepth/2)));
    const conflicts=getOverlappingRooms(sx,sz,stairWidth,stairDepth,null).filter(r=>r.type==='staircase');
    if(conflicts.length){
      flashOverlapRooms(conflicts);
      showToast('⚠️ Staircase overlaps another staircase — choose a free area','error');
      return;
    }
    const room={name:'Staircase',type:'staircase',width:stairWidth,depth:stairDepth,x:sx,z:sz,height:floorH,doors:[],windows:[]};
    floor.rooms.push(room);
    pushUndoState();
    selectedRoom=room;renderRooms();showRoomProperties(room);updateInfoPanel();drawFloorPlan();markUnsaved();
    showToast('Staircase placed — drag to reposition','success');
  }

  function addLift(){
    if(!projectData||projectData.floors.length<2){showToast('Lift requires 2+ floors — add more floors first','error');return;}
    const liftW=2,liftD=2;
    // Find a free spot on the current floor
    let x=0,z=0,placed=false,tries=0;
    const currentFloor=projectData.floors[activeFloorIdx];
    while(tries++<100){
      x=snap(Math.random()*Math.max(0,projectData.totalWidth-liftW));
      z=snap(Math.random()*Math.max(0,projectData.totalDepth-liftD));
      if(!getOverlappingRooms(x,z,liftW,liftD,null).length){placed=true;break;}
    }
    if(!placed){showToast('⚠️ No free space for lift — resize canvas or remove a room','error');return;}
    // Place lift extension on ALL floors at the exact same x,z
    projectData.floors.forEach((f,fi)=>{
      const alreadyHas=f.rooms.some(r=>r.type==='lift'&&Math.abs(r.x-x)<0.5&&Math.abs(r.z-z)<0.5);
      if(alreadyHas)return;
      const liftName=fi===0?'Lift':`Lift (F${fi+1})`;
      f.rooms.push({name:liftName,type:'lift',width:liftW,depth:liftD,x,z,height:f.height||2.7,doors:[],windows:[],_liftShaftX:x,_liftShaftZ:z});
    });
    pushUndoState();
    selectedRoom=projectData.floors[activeFloorIdx].rooms.find(r=>r.type==='lift'&&Math.abs(r.x-x)<0.5&&Math.abs(r.z-z)<0.5);
    renderRooms();if(selectedRoom)showRoomProperties(selectedRoom);
    updateInfoPanel();drawFloorPlan();markUnsaved();
    showToast('🛗 Glass lift placed on all floors at the same position','success');
  }
  window.addLift=addLift;

  function addRoomOfType(type){
    const floor=projectData.floors[activeFloorIdx];
   const defaults={living:{w:6,d:5},bedroom:{w:4,d:4},bathroom:{w:3,d:3},kitchen:{w:4,d:4},dining:{w:4,d:4},office:{w:4,d:4},garage:{w:6,d:6},balcony:{w:5,d:2},hallway:{w:6,d:2},entrance:{w:5,d:4},swimming_pool:{w:8,d:14}};
    const dim=defaults[type]||{w:4,d:4};
    let x=0,z=0,placed=false,tries=0;
    while(tries++<80){
      x=snap(Math.random()*Math.max(0,projectData.totalWidth-dim.w));
      z=snap(Math.random()*Math.max(0,projectData.totalDepth-dim.d));
      if(!getOverlappingRooms(x,z,dim.w,dim.d,null).length){placed=true;break;}
    }
    if(!placed){showToast('⚠️ No free space on this floor — resize the canvas or remove a room','error');return;}
    const names={living:'Living Room',bedroom:'Bedroom',bathroom:'Bathroom',kitchen:'Kitchen',dining:'Dining Room',office:'Office',garage:'Garage',balcony:'Balcony',hallway:'Hallway',entrance:'Entrance Area',swimming_pool:'Indoor Swimming Pool'};
    const room={name:names[type]||type,type,width:dim.w,depth:dim.d,x,z,height:floor.height||2.7,doors:[],windows:[]};
    floor.rooms.push(room);pushUndoState();selectedRoom=room;renderRooms();showRoomProperties(room);updateInfoPanel();drawFloorPlan();markUnsaved();
  }

  function addRoom(){addRoomOfType('bedroom');}
  function deleteRoom(room){const floor=projectData.floors[activeFloorIdx];const idx=floor.rooms.indexOf(room);if(idx===-1)return;floor.rooms.splice(idx,1);selectedRoom=null;renderRooms();hideRoomProperties();updateInfoPanel();drawFloorPlan();markUnsaved();}
  function deleteRoomByIndex(idx){deleteRoom(projectData.floors[activeFloorIdx].rooms[idx]);}
  function duplicateRoom(idx){
    const room=projectData.floors[activeFloorIdx].rooms[idx];
    const nr={...room,name:room.name+' (2)',x:snap(room.x+room.width+1),doors:[],windows:[]};
    if(nr.x+nr.width>projectData.totalWidth)nr.x=snap(Math.max(0,room.x-room.width-1));
    projectData.floors[activeFloorIdx].rooms.push(nr);selectedRoom=nr;renderRooms();showRoomProperties(nr);updateInfoPanel();drawFloorPlan();markUnsaved();
  }

  function clearRoomDoors(){if(!selectedRoom)return;selectedRoom.doors=[];drawFloorPlan();showRoomProperties(selectedRoom);markUnsaved();}
  function clearRoomWindows(){if(!selectedRoom)return;selectedRoom.windows=[];drawFloorPlan();showRoomProperties(selectedRoom);markUnsaved();}

  function setTool(tool){
    currentTool=tool;
    if(tool!=='measure'){_measureStart=null;_measureEnd=null;_measureActive=false;_measureComplete=false;}
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    const c=el('floorplanCanvas');
    if(tool==='door'||tool==='window'){c.style.cursor='cell';showToast(`Click near a room wall to place a ${tool}. Drag placed elements to reposition.`,'info');}
    else if(tool==='staircase'){c.style.cursor='crosshair';showToast('Click anywhere to place a staircase. Drag to move after placing.','info');}
    else if(tool==='measure'){c.style.cursor='crosshair';showToast('Click two points to measure distance between them.','info');}
    else c.style.cursor=tool==='select'?'default':'crosshair';
  }

  function setView(view){
  const controls = document.getElementById('topbar3DControls');
    if(controls){
        if(view === 'interior'){
            controls.classList.add('show');
        } else {
            controls.classList.remove('show');
        }
    }
    // Redirect old 3d view calls to interior/3dmodel sub-view
    if(view==='3d'){setView('interior');setTimeout(()=>setInteriorSubView('3dmodel'),80);return;}
    currentView=view;
    ['btn2d','btnInterior'].forEach(id=>{const b=el(id);if(b)b.classList.remove('active');});
    const canvas=el('floorplanCanvas'),intC=el('interiorContainer');
    canvas.style.display='none';intC.style.display='none';
    el('zoomControls').style.display='none';el('snapControls').style.display='none';el('snapSize').style.display='none';
    if(el('openTopToggle'))el('openTopToggle').style.display='none';
    if(el('wireframeToggleBtn'))el('wireframeToggleBtn').style.display='none';
    if(el('wireframeBtn2'))el('wireframeBtn2').style.display='none';
    if(el('fpCameraBtn'))el('fpCameraBtn').style.display='none';
    if(el('interiorSubTabs'))el('interiorSubTabs').style.display='none';
    if(el('interiorControls'))el('interiorControls').style.display='none';
    el('canvasHint').style.display='none';
    if(view==='2d'){
      el('btn2d').classList.add('active');canvas.style.display='block';
      el('zoomControls').style.display='flex';el('snapControls').style.display='flex';el('snapSize').style.display='block';
      el('canvasHint').style.display='block';drawFloorPlan();
    } else if(view==='interior'){
      el('btnInterior').classList.add('active');intC.style.display='block';
      if(el('interiorSubTabs'))el('interiorSubTabs').style.display='flex';
      if(el('interiorControls'))el('interiorControls').style.display='block';
      // Always show wireframe + walk in 3D view
      if(el('wireframeBtn2'))el('wireframeBtn2').style.display='inline-flex';
      if(el('wireframeToggleBtn'))el('wireframeToggleBtn').style.display='inline-flex';
      if(el('fpCameraBtn'))el('fpCameraBtn').style.display='inline-flex';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(typeof initInteriorView==='function')initInteriorView(projectData);
      }));
    }
  }

  function zoomIn(){zoomLevel=Math.min(4,zoomLevel+0.2);el('zoomLevel').textContent=Math.round(zoomLevel*100)+'%';drawFloorPlan();}
  function zoomOut(){zoomLevel=Math.max(0.2,zoomLevel-0.2);el('zoomLevel').textContent=Math.round(zoomLevel*100)+'%';drawFloorPlan();}
  function resetZoom(){zoomLevel=1;el('zoomLevel').textContent='100%';drawFloorPlan();}
  function refresh3D(){
    if(currentView==='interior'){
      if(typeof initInteriorView==='function')initInteriorView(projectData);
      // Re-apply current sub-view after rebuild
      setTimeout(()=>{
        const activeTab=document.querySelector('#interiorSubTabs .sub-tab.active');
        const v=activeTab?.id?.replace('sub','').toLowerCase()||'interior';
        if(typeof window._setInteriorSubView==='function')window._setInteriorSubView(v);
      },100);
    }
  }

  function setStyle(style,refresh=true){
    if(!projectData)return;
    projectData.style=style;
    document.querySelectorAll('.style-card').forEach(b=>b.classList.toggle('active',b.dataset.style===style));
    const desc=STYLES[style]?.desc||'';if(el('styleDesc'))el('styleDesc').textContent=desc;
    if(refresh){drawFloorPlan();if(currentView==='interior'&&typeof initInteriorView==='function')initInteriorView(projectData);markUnsaved();}
  }

  function updateFloorTabs(){
    const container=el('floorTabs');if(!container||!projectData)return;
    container.innerHTML=projectData.floors.map((f,i)=>`<button class="floor-tab ${activeFloorIdx===i?'active':''}" onclick="switchFloor(${i})">${f.name||`Floor ${i+1}`}</button>`).join('');
    updateFloorIsoButtons();
    // Lift button: only when 2+ floors exist
    const liftBtn=document.getElementById('liftRoomBtn');
    if(liftBtn)liftBtn.style.display=(projectData.floors.length>1)?'':'none';
  }

  function switchFloor(idx){
    activeFloorIdx=idx;
    selectedRoom=null;
    updateFloorTabs();
    renderRooms();
    hideRoomProperties();
    drawFloorPlan();
    // Garage is ground-floor only — hide on upper floors
    const garageBtn=document.getElementById('garageRoomBtn');
    if(garageBtn) garageBtn.style.display=activeFloorIdx===0?'':'none';
    // Balcony: only show on floor 2+ (index >= 1), and only when 2+ floors exist
    const balconyBtn=document.getElementById('balconyRoomBtn');
    if(balconyBtn){
      const hasMultiFloor=projectData&&projectData.floors&&projectData.floors.length>1;
      balconyBtn.style.display=(hasMultiFloor&&activeFloorIdx>0)?'':'none';
    }
    // Lift button: only when 2+ floors exist
    const liftBtn=document.getElementById('liftRoomBtn');
    if(liftBtn)liftBtn.style.display=(projectData&&projectData.floors&&projectData.floors.length>1)?'':'none';
  }
  function drawFloorPlan(){
    const canvas=el('floorplanCanvas'),ctx=canvas.getContext('2d');
    if(!canvas||!projectData)return;
    const style=projectData.style||'modern';
    const isDark=style==='modern'||style==='luxury';
    const bgColor=isDark?'#141824':'#e8ecf1';
    const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.08)';
    const boundaryColor=style==='luxury'?'#c9a84c':style==='minimalist'?'#bbb':'#5b7cfa';
    const textColor=isDark?'#e2e8f0':'#1a1a2e';
    const dimColor=isDark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.4)';
    ctx.fillStyle=bgColor;ctx.fillRect(0,0,canvas.width,canvas.height);
    const scale=getScale(),off=getOffset();
    ctx.strokeStyle=gridColor;ctx.lineWidth=1;
    for(let i=0;i<=projectData.totalWidth;i++){ctx.beginPath();ctx.moveTo(off.x+i*scale,off.y);ctx.lineTo(off.x+i*scale,off.y+projectData.totalDepth*scale);ctx.stroke();}
    for(let i=0;i<=projectData.totalDepth;i++){ctx.beginPath();ctx.moveTo(off.x,off.y+i*scale);ctx.lineTo(off.x+projectData.totalWidth*scale,off.y+i*scale);ctx.stroke();}
    ctx.strokeStyle=boundaryColor;ctx.lineWidth=3;
    ctx.strokeRect(off.x,off.y,projectData.totalWidth*scale,projectData.totalDepth*scale);
    ctx.fillStyle=isDark?'rgba(91,124,250,0.04)':'rgba(91,124,250,0.03)';
    ctx.fillRect(off.x,off.y,projectData.totalWidth*scale,projectData.totalDepth*scale);
    ctx.fillStyle=dimColor;ctx.font=`11px 'Inter',sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText(`${projectData.totalWidth}m`,off.x+(projectData.totalWidth*scale)/2,off.y-18);
    ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.save();ctx.translate(off.x-18,off.y+(projectData.totalDepth*scale)/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${projectData.totalDepth}m`,0,0);ctx.restore();
    projectData.floors.forEach((floor,fi)=>{
      const isActive=fi===activeFloorIdx;
      floor.rooms.forEach(room=>{
        const rc=ROOM_COLORS[room.type]||ROOM_COLORS.other;
        const rx=off.x+room.x*scale,ry=off.y+room.z*scale,rw=room.width*scale,rh=room.depth*scale;
        const isSel=selectedRoom===room&&isActive;
        const isFlash=room._overlapFlash&&isActive;
        ctx.fillStyle=isFlash?'rgba(239,68,68,0.35)':isActive?rc.bg:'rgba(100,100,100,0.1)';ctx.fillRect(rx,ry,rw,rh);
        ctx.strokeStyle=isFlash?'#ef4444':isSel?'#fff':isActive?rc.border:'#555';ctx.lineWidth=isFlash?2.5:isSel?2.5:isActive?1.5:1;ctx.strokeRect(rx,ry,rw,rh);
        if(isFlash){ctx.strokeStyle='#ef4444';ctx.lineWidth=4;ctx.globalAlpha=0.5;ctx.strokeRect(rx-2,ry-2,rw+4,rh+4);ctx.globalAlpha=1;}
        else if(isSel){ctx.strokeStyle=rc.border;ctx.lineWidth=4;ctx.globalAlpha=0.4;ctx.strokeRect(rx-2,ry-2,rw+4,rh+4);ctx.globalAlpha=1;}
        if(rw>35&&rh>28&&isActive){
          ctx.fillStyle=textColor;ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.font=`bold ${Math.min(12,rw/(room.name.length*0.6))}px 'Inter',sans-serif`;
          ctx.fillText(room.name,rx+rw/2,ry+rh/2-8);
          ctx.font=`10px 'Inter',sans-serif`;ctx.fillStyle=dimColor;
          ctx.fillText(`${room.width}x${room.depth}m`,rx+rw/2,ry+rh/2+8);
        }
        // Staircase 2D: draw step lines
        if(room.type==='staircase'&&isActive){
          const steps=Math.max(5,Math.floor(rh/8));
          ctx.strokeStyle=isDark?'rgba(255,150,50,0.6)':'rgba(200,100,20,0.5)';ctx.lineWidth=1;
          for(let si=1;si<steps;si++){
            const sy=ry+si*(rh/steps);
            ctx.beginPath();ctx.moveTo(rx+2,sy);ctx.lineTo(rx+rw-2,sy);ctx.stroke();
          }
          // Arrow indicating direction
          ctx.strokeStyle='#ff9632';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(rx+rw/2,ry+rh-6);ctx.lineTo(rx+rw/2,ry+6);ctx.stroke();
          ctx.beginPath();ctx.moveTo(rx+rw/2-5,ry+12);ctx.lineTo(rx+rw/2,ry+6);ctx.lineTo(rx+rw/2+5,ry+12);ctx.stroke();
        }
        // Lift 2D: draw glass elevator symbol
        if(room.type==='lift'&&isActive){
          const lcx=rx+rw/2,lcy=ry+rh/2;
          // Inner frame (steel)
          ctx.strokeStyle='#56ccf2';ctx.lineWidth=1.5;
          ctx.strokeRect(rx+3,ry+3,rw-6,rh-6);
          // Diagonal cross-lines (glass panel pattern)
          ctx.strokeStyle='rgba(86,204,242,0.3)';ctx.lineWidth=1;
          ctx.beginPath();ctx.moveTo(rx+3,ry+3);ctx.lineTo(rx+rw-3,ry+rh-3);ctx.stroke();
          ctx.beginPath();ctx.moveTo(rx+rw-3,ry+3);ctx.lineTo(rx+3,ry+rh-3);ctx.stroke();
          // Up arrow
          ctx.strokeStyle='#00d4ff';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(lcx,lcy-4);ctx.lineTo(lcx,lcy-12);ctx.stroke();
          ctx.beginPath();ctx.moveTo(lcx-5,lcy-8);ctx.lineTo(lcx,lcy-14);ctx.lineTo(lcx+5,lcy-8);ctx.stroke();
          // Down arrow
          ctx.beginPath();ctx.moveTo(lcx,lcy+4);ctx.lineTo(lcx,lcy+12);ctx.stroke();
          ctx.beginPath();ctx.moveTo(lcx-5,lcy+8);ctx.lineTo(lcx,lcy+14);ctx.lineTo(lcx+5,lcy+8);ctx.stroke();
          // Glow dot center
          ctx.beginPath();ctx.arc(lcx,lcy,3,0,Math.PI*2);ctx.fillStyle='#00d4ff';ctx.fill();
          // Animated shimmer ring
          const shimR=4+2*Math.abs(Math.sin(Date.now()*0.003));
          ctx.beginPath();ctx.arc(lcx,lcy,shimR,0,Math.PI*2);ctx.strokeStyle='rgba(0,212,255,0.4)';ctx.lineWidth=1;ctx.stroke();
        }
        if(isActive)drawRoomElements(ctx,room,rx,ry,rw,rh,scale,isDark);
      });
    });
    if(selectedRoom&&currentView==='2d'){
      const room=selectedRoom,rx=off.x+room.x*scale,ry=off.y+room.z*scale,rw=room.width*scale,rh=room.depth*scale;
      [[rx,ry],[rx+rw/2,ry],[rx+rw,ry],[rx,ry+rh/2],[rx+rw,ry+rh/2],[rx,ry+rh],[rx+rw/2,ry+rh],[rx+rw,ry+rh]].forEach(([hx,hy])=>{
        ctx.beginPath();ctx.arc(hx,hy,HANDLE_SIZE,0,Math.PI*2);ctx.fillStyle='#ff8c00';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      });
    }
    ctx.textAlign='center';ctx.fillStyle=isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.3)';ctx.font=`bold 13px 'Inter',sans-serif`;ctx.textBaseline='top';
    ctx.fillText(`${projectData.name}  ·  ${STYLES[projectData.style]?.label||''} Style  ·  Floor ${activeFloorIdx+1}`,canvas.width/2,10);
    ctx.textAlign='left';ctx.fillStyle=dimColor;ctx.font='10px monospace';ctx.textBaseline='bottom';
    ctx.fillText(`Scale: 1m=${scale.toFixed(0)}px  |  Zoom: ${Math.round(zoomLevel*100)}%`,off.x,canvas.height-8);
    drawCompass(ctx,canvas.width-40,canvas.height-40,22,isDark);
    // Draw measure tool overlay
    if(currentTool==='measure'){
      if(_measureStart){
        const sp=toCanvas(_measureStart.x,_measureStart.y);
        ctx.beginPath();ctx.arc(sp.x,sp.y,6,0,Math.PI*2);ctx.fillStyle='#f0c040';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
        if(_measureActive&&!_measureComplete){
          ctx.fillStyle='#f0c040';ctx.font='bold 11px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
          ctx.fillText('Click second point to measure',sp.x+10,sp.y-14);
        }
      }
      if(_measureStart&&_measureEnd){
        const sp=toCanvas(_measureStart.x,_measureStart.y),ep=toCanvas(_measureEnd.x,_measureEnd.y);
        ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(ep.x,ep.y);ctx.strokeStyle='#f0c040';ctx.lineWidth=2;ctx.setLineDash([6,3]);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.arc(ep.x,ep.y,6,0,Math.PI*2);ctx.fillStyle='#f0c040';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
        const dx=_measureEnd.x-_measureStart.x,dy=_measureEnd.y-_measureStart.y,dist=Math.sqrt(dx*dx+dy*dy).toFixed(2);
        const mx2=(sp.x+ep.x)/2,my2=(sp.y+ep.y)/2;
        ctx.fillStyle='#f0c040';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.strokeText(`${dist} m`,mx2,my2-12);ctx.fillText(`${dist} m`,mx2,my2-12);
        if(_measureComplete){
          ctx.fillStyle='rgba(240,192,64,0.7)';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText('Click to measure again',mx2,my2+6);
        }
      }
    }
  }

  function drawRoomElements(ctx,room,rx,ry,rw,rh,scale,isDark){
    (room.doors||[]).forEach(door=>{
      const pos=door.pos??0.5,dw=Math.max(20,(door.width||0.9)*scale);
      let dx,dy,angle;
      switch(door.wall){case'top':dx=rx+pos*rw;dy=ry;angle=0;break;case'bottom':dx=rx+pos*rw;dy=ry+rh;angle=Math.PI;break;case'left':dx=rx;dy=ry+pos*rh;angle=-Math.PI/2;break;case'right':dx=rx+rw;dy=ry+pos*rh;angle=Math.PI/2;break;default:dx=rx+rw/2;dy=ry;angle=0;}
      ctx.save();ctx.translate(dx,dy);ctx.rotate(angle);
      ctx.strokeStyle='#ff8c00';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-dw/2,0);ctx.lineTo(dw/2,0);ctx.stroke();
      ctx.beginPath();ctx.arc(-dw/2,0,dw,0,Math.PI/2);ctx.strokeStyle='#ff8c0088';ctx.stroke();
      ctx.fillStyle='#ff8c00';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    (room.windows||[]).forEach(win=>{
      const pos=win.pos??0.5,ww=Math.max(16,(win.width||1.0)*scale);
      let wx,wy,isH;
      switch(win.wall){case'top':wx=rx+pos*rw;wy=ry;isH=true;break;case'bottom':wx=rx+pos*rw;wy=ry+rh;isH=true;break;case'left':wx=rx;wy=ry+pos*rh;isH=false;break;case'right':wx=rx+rw;wy=ry+pos*rh;isH=false;break;default:wx=rx+rw/2;wy=ry;isH=true;}
      ctx.strokeStyle='#56ccf2';ctx.lineWidth=3;
      if(isH){ctx.beginPath();ctx.moveTo(wx-ww/2,wy-3);ctx.lineTo(wx+ww/2,wy-3);ctx.stroke();ctx.beginPath();ctx.moveTo(wx-ww/2,wy+3);ctx.lineTo(wx+ww/2,wy+3);ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(wx-3,wy-ww/2);ctx.lineTo(wx-3,wy+ww/2);ctx.stroke();ctx.beginPath();ctx.moveTo(wx+3,wy-ww/2);ctx.lineTo(wx+3,wy+ww/2);ctx.stroke();}
      ctx.fillStyle='#56ccf2aa';ctx.beginPath();ctx.arc(wx,wy,4,0,Math.PI*2);ctx.fill();
    });
  }

  function drawPlacementPreview(mx,my,type){
    const canvas=el('floorplanCanvas'),ctx=canvas.getContext('2d');
    const w=toWorld(mx,my),floor=projectData.floors[activeFloorIdx];if(!floor)return;
    const color=type==='door'?'#ff8c00':'#56ccf2';
    const margin=0.5;
    for(const room of floor.rooms){
      const rx=room.x,ry=room.z,rw=room.width,rd=room.depth;
      const onWall=(Math.abs(w.y-ry)<margin&&w.x>=rx&&w.x<=rx+rw)||(Math.abs(w.y-(ry+rd))<margin&&w.x>=rx&&w.x<=rx+rw)||(Math.abs(w.x-rx)<margin&&w.y>=ry&&w.y<=ry+rd)||(Math.abs(w.x-(rx+rw))<margin&&w.y>=ry&&w.y<=ry+rd);
      if(onWall){
        ctx.fillStyle=color;ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(mx,my,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
        ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(mx,my,16,0,Math.PI*2);ctx.stroke();break;
      }
    }
  }

  function drawCompass(ctx,cx,cy,r,isDark){
    const rad=_compassAngle*Math.PI/180;
    const label=_COMPASS_DIRS[(_compassAngle/90)%4];
    ctx.save();
    // Background circle
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle=isDark?'rgba(15,20,40,0.8)':'rgba(255,255,255,0.85)';ctx.fill();
    ctx.strokeStyle=window._compassHover?'#5b7cfa':(isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.2)');
    ctx.lineWidth=window._compassHover?2:1.5;ctx.stroke();
    // Rotating arrows
    ctx.translate(cx,cy);ctx.rotate(rad);
    // North arrow — red
    ctx.fillStyle='#ef4444';
    ctx.beginPath();ctx.moveTo(0,-(r-5));ctx.lineTo(-4,1);ctx.lineTo(4,1);ctx.closePath();ctx.fill();
    // South arrow — grey
    ctx.fillStyle=isDark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.2)';
    ctx.beginPath();ctx.moveTo(0,r-5);ctx.lineTo(-4,-1);ctx.lineTo(4,-1);ctx.closePath();ctx.fill();
    ctx.restore();
    // Direction label in centre
    ctx.fillStyle=window._compassHover?'#5b7cfa':'#7aa0ff';
    ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,cx,cy);
    // Hover tooltip
    if(window._compassHover){
      const tip=`Click to rotate (${_compassAngle}°)`;
      ctx.font='10px Inter,sans-serif';
      const tw=ctx.measureText(tip).width+14;
      const tx=Math.min(cx,ctx.canvas?ctx.canvas.width-tw/2-4:cx);
      ctx.fillStyle=isDark?'rgba(15,20,40,0.9)':'rgba(255,255,255,0.95)';
      ctx.strokeStyle='rgba(91,124,250,0.5)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(tx-tw/2,cy-r-26,tw,18,4);ctx.fill();ctx.stroke();
      ctx.fillStyle=isDark?'#c0c8de':'#333';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(tip,tx,cy-r-17);
    }
  }

  function renderRooms(){
    const container=el('roomsList');if(!container||!projectData)return;
    const floor=projectData.floors[activeFloorIdx];
    if(!floor||floor.rooms.length===0){container.innerHTML='<p class="empty-msg">No rooms on this floor</p>';return;}
    container.innerHTML=floor.rooms.map((room,i)=>{
      const rc=ROOM_COLORS[room.type]||ROOM_COLORS.other;
      return`<div class="room-item ${selectedRoom===room?'selected':''}" onclick="selectByIdx(${i})">
        <div class="room-dot" style="background:${rc.dot}"></div>
        <div class="room-info"><div class="room-name">${room.name}</div><div class="room-dims">${room.width}m x ${room.depth}m &middot; ${(room.width*room.depth).toFixed(0)}m&sup2;</div></div>
        <div class="room-actions"><button onclick="event.stopPropagation();duplicateRoom(${i})" title="Duplicate"><i class="fas fa-copy"></i></button><button onclick="event.stopPropagation();deleteRoomByIndex(${i})" title="Delete"><i class="fas fa-trash"></i></button></div>
      </div>`;
    }).join('');
  }

  function selectByIdx(idx){
    selectedRoom=projectData.floors[activeFloorIdx].rooms[idx];
    renderRooms();showRoomProperties(selectedRoom);drawFloorPlan();
    if(currentView==='interior'&&window.focusInteriorRoom){const ox=-projectData.totalWidth/2,oz=-projectData.totalDepth/2;window.focusInteriorRoom(selectedRoom,ox,oz);}
  }
  function selectRoomByIndex(idx){selectByIdx(idx);}

  function showRoomProperties(room){
    const container=el('roomProperties');if(!container)return;
    const typeOpts=['living','bedroom','bathroom','kitchen','dining','office','garage','hallway','entrance','swimming_pool','other'].map(t=>`<option value="${t}" ${room.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
    container.innerHTML=`
      <div class="form-group"><label>Name</label><input type="text" value="${room.name}" onchange="updateRoomProp('name',this.value)"></div>
      <div class="form-group"><label>Type</label><select onchange="updateRoomProp('type',this.value)">${typeOpts}</select></div>
      <div class="form-row2">
        <div class="form-group"><label>Width (m)</label><input type="number" value="${room.width}" min="1" step="0.5" onchange="updateRoomProp('width',parseFloat(this.value))"></div>
        <div class="form-group"><label>Depth (m)</label><input type="number" value="${room.depth}" min="1" step="0.5" onchange="updateRoomProp('depth',parseFloat(this.value))"></div>
      </div>
      <div class="form-row2">
        <div class="form-group"><label>X (m)</label><input type="number" value="${room.x.toFixed(1)}" step="0.5" onchange="updateRoomProp('x',parseFloat(this.value))"></div>
        <div class="form-group"><label>Z (m)</label><input type="number" value="${room.z.toFixed(1)}" step="0.5" onchange="updateRoomProp('z',parseFloat(this.value))"></div>
      </div>
      <div class="form-group"><label>Ceiling (m)</label><input type="number" value="${room.height||2.7}" min="2" max="6" step="0.1" onchange="updateRoomProp('height',parseFloat(this.value))"></div>
      <div style="margin:0.4rem 0;padding:0.4rem;background:rgba(255,255,255,0.05);border-radius:5px;font-size:0.7rem;color:#8899bb;">Area: ${(room.width*room.depth).toFixed(1)}m&sup2; &middot; Doors: ${(room.doors||[]).length} &middot; Windows: ${(room.windows||[]).length} &middot; <span style="color:#a8c4ff;">Est: $${((room.width*room.depth*getRoomRate(room.type))/1000).toFixed(1)}k</span></div>
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="zoom-btn" style="flex:1;font-size:0.7rem;" onclick="clearRoomDoors()">Clear Doors</button>
        <button class="zoom-btn" style="flex:1;font-size:0.7rem;" onclick="clearRoomWindows()">Clear Windows</button>
      </div>`;
  }
  function hideRoomProperties(){const c=el('roomProperties');if(c)c.innerHTML='<p class="empty-msg">Select a room to edit</p>';}
  function updateRoomProp(prop,val){
    if(!selectedRoom)return;
    if(selectedRoom.type==='garage'&&(prop==='width'||prop==='depth')){
      const minGarage=6;
      if(val<minGarage){
        showToast(`⚠️ Garage ${prop} cannot be less than ${minGarage}m — required for vehicle clearance.`,'error');
        // Reset the input back to current value
        const inputs=document.querySelectorAll('#roomProperties input[type="number"]');
        inputs.forEach(inp=>{if((prop==='width'&&inp.closest('.form-group')?.querySelector('label')?.textContent==='Width (m)')||(prop==='depth'&&inp.closest('.form-group')?.querySelector('label')?.textContent==='Depth (m)'))inp.value=selectedRoom[prop];});
        return;
      }
    }
    selectedRoom[prop]=val;
    if(['width','depth','x','z'].includes(prop)){
      if(selectedRoom.type==='garage'){selectedRoom.width=Math.max(6,selectedRoom.width);selectedRoom.depth=Math.max(6,selectedRoom.depth);}
      else{selectedRoom.width=Math.max(1,selectedRoom.width);selectedRoom.depth=Math.max(1,selectedRoom.depth);}
      selectedRoom.x=Math.max(0,Math.min(projectData.totalWidth-selectedRoom.width,selectedRoom.x));
      selectedRoom.z=Math.max(0,Math.min(projectData.totalDepth-selectedRoom.depth,selectedRoom.z));
    }
    // ── Lift shaft sync: propagate width/depth/height to all matching lift rooms on other floors ──
    if(selectedRoom.type==='lift'&&['width','depth','height'].includes(prop)){
      const sx=selectedRoom._liftShaftX??selectedRoom.x;
      const sz=selectedRoom._liftShaftZ??selectedRoom.z;
      projectData.floors.forEach(f=>{
        f.rooms.forEach(r=>{
          if(r!==selectedRoom&&r.type==='lift'&&Math.abs((r._liftShaftX??r.x)-sx)<0.5&&Math.abs((r._liftShaftZ??r.z)-sz)<0.5){
            r[prop]=selectedRoom[prop];
          }
        });
      });
    }
    renderRooms();drawFloorPlan();updateInfoPanel();markUnsaved();
  }
  function updateProjectSettings(){
    if(!projectData)return;
    projectData.totalWidth=parseFloat(el('totalWidth').value)||20;
    projectData.totalDepth=parseFloat(el('totalDepth').value)||15;
    if(!projectData.specifications)projectData.specifications={};
    projectData.specifications.roofType=el('roofType').value;
    let numFloors=parseInt(el('numFloors').value)||1;
    const floorH=parseFloat(el('floorHeight').value)||2.7;

    // Multi-floor is a Pro+ feature
    if(numFloors>1&&_getUserPlan()==='free'){
      el('numFloors').value=1;  // snap input back to 1
      numFloors=1;
      if(typeof window.showPlanLimitModal==='function')
        window.showPlanLimitModal('multifloor','free');
    }

   while(projectData.floors.length<numFloors){const lvl=projectData.floors.length+1;projectData.floors.push({level:lvl,name:`Floor ${lvl}`,height:floorH,rooms:[]});}
    while(projectData.floors.length>numFloors)projectData.floors.pop();
    projectData.floors.forEach(f=>f.height=floorH);
    if(activeFloorIdx>=projectData.floors.length)activeFloorIdx=projectData.floors.length-1;
    // Sync balcony button visibility with floor count
    const balconyBtn=document.getElementById('balconyRoomBtn');
    if(balconyBtn){
      const hasMultiFloor=projectData.floors.length>1;
      balconyBtn.style.display=(hasMultiFloor&&activeFloorIdx>0)?'':'none';
    }
    // Sync lift button visibility with floor count
    const liftBtn=document.getElementById('liftRoomBtn');
    if(liftBtn)liftBtn.style.display=(projectData.floors.length>1)?'':'none';
    updateFloorTabs();drawFloorPlan();updateInfoPanel();markUnsaved();
    if(currentView==='3d')init3DView();
  }
  function updateProjectTitle(){if(projectData){projectData.name=el('projectTitle').value;markUnsaved();}}
  function markUnsaved(){const s=el('saveStatus');if(s){s.textContent='Unsaved';s.classList.add('unsaved');}pushUndoState();}

  // ── Undo / Redo ─────────────────────────────────────────────
  const _undoStack=[];const _redoStack=[];let _lastPushed='';
  function _serializeState(){return JSON.stringify({floors:projectData.floors,totalWidth:projectData.totalWidth,totalDepth:projectData.totalDepth,style:projectData.style,specifications:projectData.specifications});}
  function pushUndoState(){
    const s=_serializeState();if(s===_lastPushed)return;
    _undoStack.push(s);if(_undoStack.length>60)_undoStack.shift();
    _redoStack.length=0;_lastPushed=s;_syncUndoButtons();
  }
  function undo(){
    if(_undoStack.length<2)return;
    _redoStack.push(_undoStack.pop());
    const prev=_undoStack[_undoStack.length-1];
    if(!prev)return;
    _applyStateSnapshot(prev);showToast('Undo','info');_syncUndoButtons();
  }
  function redo(){
    if(!_redoStack.length)return;
    const next=_redoStack.pop();
    _undoStack.push(next);_lastPushed=next;
    _applyStateSnapshot(next);showToast('Redo','info');_syncUndoButtons();
  }
  function _applyStateSnapshot(s){
    const snap=JSON.parse(s);
    projectData.floors=snap.floors;projectData.totalWidth=snap.totalWidth;projectData.totalDepth=snap.totalDepth;
    projectData.style=snap.style;projectData.specifications=snap.specifications;
    if(el('totalWidth'))el('totalWidth').value=snap.totalWidth;
    if(el('totalDepth'))el('totalDepth').value=snap.totalDepth;
    if(el('numFloors'))el('numFloors').value=snap.floors.length;
    if(activeFloorIdx>=snap.floors.length)activeFloorIdx=snap.floors.length-1;
    selectedRoom=null;updateFloorTabs();renderRooms();hideRoomProperties();updateInfoPanel();drawFloorPlan();
    if(currentView==='interior'&&typeof initInteriorView==='function')initInteriorView(projectData);
  }
  function _syncUndoButtons(){
    const ub=el('undoBtn'),rb=el('redoBtn');
    if(ub)ub.disabled=_undoStack.length<2;
    if(rb)rb.disabled=_redoStack.length===0;
  }

  // ── Floor Isolation (per-floor 3D view) ─────────────────────
  let _isolatedFloor=-1; // -1 = all floors
  function viewFloor(floorIdx){
    _isolatedFloor=floorIdx;
    const allBtns=document.querySelectorAll('.floor-iso-btn');
    allBtns.forEach(b=>b.classList.toggle('active',parseInt(b.dataset.fi)===floorIdx));
    if(floorIdx===-1){showToast('Showing all floors','info');}
    else{showToast(`Viewing Floor ${floorIdx+1} only`,'info');}
    if(currentView==='interior'&&typeof initInteriorView==='function'){
      // Create temporary projectData view with only that floor
      if(floorIdx===-1){initInteriorView(projectData);}
      else{
        const fake={...projectData,floors:[projectData.floors[floorIdx]]};
        initInteriorView(fake);
      }
    }
  }
  function updateFloorIsoButtons(){
    const c=el('floorIsoButtons');if(!c||!projectData)return;
    let html=`<button class="floor-iso-btn ${_isolatedFloor===-1?'active':''}" data-fi="-1" onclick="viewFloor(-1)" title="Show all floors"><i class="fas fa-layer-group"></i> All</button>`;
    projectData.floors.forEach((f,i)=>{
      html+=`<button class="floor-iso-btn ${_isolatedFloor===i?'active':''}" data-fi="${i}" onclick="viewFloor(${i})" title="View ${f.name||'Floor '+(i+1)} in 3D"><i class="fas fa-building"></i> F${i+1}</button>`;
    });
    c.innerHTML=html;
  }

  function updateInfoPanel(){
    if(!projectData)return;
    const allRooms=projectData.floors.flatMap(f=>f.rooms);
    const totalArea=projectData.totalWidth*projectData.totalDepth*projectData.floors.length;

    // Per-room cost using type-specific rates
    const totalCost=allRooms.reduce((s,r)=>s+r.width*r.depth*getRoomRate(r.type),0);

    if(el('totalArea'))el('totalArea').textContent=totalArea.toFixed(0);
    if(el('roomCount'))el('roomCount').textContent=allRooms.length;
    if(el('floorCount'))el('floorCount').textContent=projectData.floors.length;
    if(el('estimatedCost'))el('estimatedCost').textContent='$'+(totalCost/1000).toFixed(0)+'k';

    const bd=el('costBreakdown');
    if(bd){
      if(allRooms.length===0){bd.innerHTML='<p class="empty-msg">Add rooms to see estimate</p>';return;}

      // Group rooms by type for the breakdown table
      const byType={};
      allRooms.forEach(r=>{
        const t=r.type||'other';
        if(!byType[t])byType[t]={area:0,cost:0,count:0};
        const a=r.width*r.depth;
        byType[t].area+=a;
        byType[t].cost+=a*getRoomRate(t);
        byType[t].count++;
      });

      const label=t=>t.charAt(0).toUpperCase()+t.slice(1);
      const rows=Object.entries(byType)
        .sort((a,b)=>b[1].cost-a[1].cost)
        .map(([t,d])=>{
          const pct=totalCost>0?((d.cost/totalCost)*100).toFixed(0):0;
          return `<div class="cost-item">
            <span>${label(t)} <span style="color:var(--text-dim);font-size:0.7rem">${d.count > 1 ? '×'+d.count+' · ' : ''}${d.area.toFixed(1)}m²</span></span>
            <span>$${(d.cost/1000).toFixed(0)}k <span style="color:var(--text-dim);font-size:0.7rem">${pct}%</span></span>
          </div>`;
        }).join('');

      bd.innerHTML=rows+`<div class="cost-item"><span><strong>Total</strong></span><span><strong>$${(totalCost/1000).toFixed(0)}k</strong></span></div>`;
    }
    if(typeof updateOverlapBtn==='function')updateOverlapBtn();
    updateBudgetProgress();
  }

  // ── BUDGET CAP ──────────────────────────────────────────────────────────────
  function updateBudgetCap(val){
    if(!projectData)return;
    const capK=parseFloat(val)||0;
    projectData.budget=capK>0?capK*1000:null;  // store as full dollars internally
    updateBudgetProgress();
    markUnsaved();
  }

  function updateBudgetProgress(){
    const wrap=el('budgetProgressWrap');
    const fill=el('budgetProgressFill');
    const usedLbl=el('budgetUsedLabel');
    const remLbl=el('budgetRemainLabel');
    if(!wrap||!fill||!usedLbl||!remLbl||!projectData)return;

    const cap=projectData.budget||0;
    if(!cap){wrap.style.display='none';return;}

    const allRooms=projectData.floors.flatMap(f=>f.rooms);
    const used=allRooms.reduce((s,r)=>s+r.width*r.depth*getRoomRate(r.type),0);
    const pct=Math.min((used/cap)*100,100);
    const remain=cap-used;

    wrap.style.display='block';
    fill.style.width=pct.toFixed(1)+'%';
    fill.classList.toggle('warn',pct>=75&&pct<100);
    fill.classList.toggle('over',pct>=100);

    usedLbl.textContent='$'+(used/1000).toFixed(0)+'k used';
    usedLbl.style.color=pct>=100?'var(--danger)':pct>=75?'var(--warning)':'var(--text-muted)';
    if(remain>=0){
      remLbl.textContent='$'+(remain/1000).toFixed(0)+'k remaining';
      remLbl.style.color=remain<cap*0.25?'var(--warning)':'var(--text-muted)';
    }else{
      remLbl.textContent='+$'+(Math.abs(remain)/1000).toFixed(0)+'k over budget';
      remLbl.style.color='var(--danger)';
    }
  }

  // ── EDITABLE RATES ───────────────────────────────────────────────────────────
  const DEFAULT_RATES={living:1800,bedroom:1600,bathroom:2800,kitchen:3200,dining:1700,office:1900,garage:900,staircase:1400,hallway:1100,other:1500};

  function toggleRatesPanel(){
    const panel=el('ratesPanel');
    const chevron=el('ratesChevron');
    if(!panel)return;
    const open=panel.style.display==='none';
    panel.style.display=open?'block':'none';
    if(chevron)chevron.classList.toggle('open',open);
    if(open)renderRatesGrid();
  }

  function renderRatesGrid(){
    const grid=el('ratesGrid');if(!grid)return;
    const dots={living:'#5b7cfa',bedroom:'#38ef7d',bathroom:'#56ccf2',kitchen:'#ffc107',dining:'#9c88ff',office:'#74b9ff',garage:'#828c9b',staircase:'#ff9632',hallway:'#c8a96e',entrance:'#d4a96e',other:'#aaa'};
    const labels={living:'Living',bedroom:'Bedroom',bathroom:'Bathroom',kitchen:'Kitchen',dining:'Dining',office:'Office',garage:'Garage',staircase:'Staircase',hallway:'Hallway',entrance:'Entrance',other:'Other'};
    grid.innerHTML=Object.keys(DEFAULT_RATES).map(type=>`
      <div class="rate-row">
        <span class="rate-label">
          <span class="rate-dot" style="background:${dots[type]}"></span>
          ${labels[type]}
        </span>
        <div class="rate-input-wrap">
          <span>$/m²</span>
          <input type="number" min="100" max="99999" step="50"
                value="${getRoomRate(type)}"
                onchange="setRate('${type}',parseFloat(this.value)||${DEFAULT_RATES[type]})">
        </div>
      </div>`).join('');
  }

  function setRate(type,val){
    ROOM_RATES[type]=Math.max(100,Math.round(val));
    updateInfoPanel();
    updateBudgetProgress();
    if(selectedRoom)showRoomProperties(selectedRoom);
    markUnsaved();
  }

  function resetRates(){
    Object.keys(DEFAULT_RATES).forEach(t=>ROOM_RATES[t]=DEFAULT_RATES[t]);
    renderRatesGrid();
    updateInfoPanel();
    updateBudgetProgress();
    if(selectedRoom)showRoomProperties(selectedRoom);
  }

  async function saveProject(){
    try{
      showLoading('Saving...');projectData.name=el('projectTitle').value;
      if(projectId){
        await api.updateProject(projectId,projectData);
      } else {
        // If opened from a client connection, tag the payload with connectionId so
        // the backend plan-limit guard allows the save regardless of project count.
        const ctx = window._clientConnectionContext;
        const createPayload = (ctx && ctx.connectionId)
          ? Object.assign({}, projectData, { connectionId: ctx.connectionId })
          : projectData;
        const d=await api.createProject(createPayload);
        projectId=d.data._id;
        window.history.replaceState({},'',`?id=${projectId}`);
        if(typeof initReviewsPanel==='function') initReviewsPanel(projectId);
        // If opened from a client connection, auto-share this new project with the client
        if (ctx && ctx.connectionId) {
          try {
            const token = localStorage.getItem('token');
            // Fetch the connection to get the client ID
            const connRes  = await fetch(`http://localhost:5000/api/connections/my`, { headers: { 'Authorization': 'Bearer ' + token } });
            const connData = await connRes.json();
            if (connData.success) {
              const conn = (connData.data || []).find(c => String(c._id) === String(ctx.connectionId));
              if (conn) {
                const clientId = conn.client?._id || conn.client;
               await fetch(`http://localhost:5000/api/projects/${projectId}/share`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                  body: JSON.stringify({ mode: 'connection', clientId, connectionId: ctx.connectionId, message: 'Your architect has started working on your project!' })
                });

                // ── NEW: if this is an additional project, link it so the stepper shows on the card ──
                if (ctx.additionalProjectId) {
                  await fetch(`http://localhost:5000/api/connections/${ctx.connectionId}/additional-projects/${ctx.additionalProjectId}/link`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ architectProjectId: projectId })
                  });
                }
              }
            }
          } catch(shareErr) { console.warn('Auto-share on first save failed:', shareErr); }
        }
      }
      const s=el('saveStatus');if(s){s.textContent='Saved';s.classList.remove('unsaved');}
      hideLoading();showToast('Project saved!','success');
    }catch(e){hideLoading();showToast('Save failed','error');console.error(e);}
  }

  // ── Export Dropdown ────────────────────────────────────────────
  function toggleExportDropdown(e){
    e.stopPropagation();
    const dd=el('exportDropdown'),wrap=el('exportDropdownWrap');
    const open=dd.classList.contains('open');
    dd.classList.toggle('open',!open);
    wrap.classList.toggle('open',!open);
  }
  document.addEventListener('click',()=>{
    const dd=el('exportDropdown'),wrap=el('exportDropdownWrap');
    if(dd)dd.classList.remove('open');
    if(wrap)wrap.classList.remove('open');
  });

  // ── Shared helpers ─────────────────────────────────────────────
  function _triggerDownload(url,filename){
    const a=document.createElement('a');a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function _safeName(){ return (projectData.name||'project').replace(/[^a-z0-9_\-\s]/gi,'_').trim(); }
  async function _backendExport(path,name,ext,mime,toast){
    try{
      showLoading(`Generating ${ext.toUpperCase()} file…`);
      const resp=await fetch(`http://localhost:3001/api/architecture/export/${path}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(projectData)});
      if(!resp.ok){const err=await resp.json().catch(()=>({}));throw new Error(err.message||`${ext} export failed`);}
      const blob=await resp.blob();
      _triggerDownload(URL.createObjectURL(blob),`${name}.${ext}`);
      showToast(toast,'success');
    }catch(e){
      console.error(e);
      showToast(`${ext.toUpperCase()} export failed — is the AI backend running on port 3001?`,'error');
    }finally{ hideLoading(); }
  }

  // ── Helper: get current user plan from localStorage ────────────
  function _getUserPlan(){
    try{
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      // plan field must exist and be a known value; default to 'free'
      return ['free','pro','enterprise'].includes(u.plan) ? u.plan : 'free';
    }catch{ return 'free'; }
  }

  // ── Refresh localStorage user from server (call after plan changes) ──
  async function _refreshUserPlan(){
    try{
      const fresh = await fetch('http://localhost:5000/api/auth/me',{
        headers:{ 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await fresh.json();
      if(data && data.user) localStorage.setItem('user', JSON.stringify(data.user));
    }catch(_){}
  }

  // ── Core export dispatcher ─────────────────────────────────────
  async function exportProject(format='json'){
    el('exportDropdown')?.classList.remove('open');
    el('exportDropdownWrap')?.classList.remove('open');

    // Pro-only formats: cad, obj, stl, gltf
    const PRO_FORMATS=['cad','obj','stl','gltf'];
    if(PRO_FORMATS.includes(format)&&_getUserPlan()==='free'){
      if(typeof window.showPlanLimitModal==='function')
        window.showPlanLimitModal('export','free');
      return;
    }

    const name=_safeName();

    switch(format){
      case 'json':{
        const blob=new Blob([JSON.stringify(projectData,null,2)],{type:'application/json'});
        _triggerDownload(URL.createObjectURL(blob),`${name}.json`);
        showToast('Project exported as JSON!','success');
        break;
      }
      case 'svg':{
        const blob=new Blob([_generateSVG()],{type:'image/svg+xml'});
        _triggerDownload(URL.createObjectURL(blob),`${name}.svg`);
        showToast('Floor plan exported as SVG!','success');
        break;
      }
      case 'cad':
        await _backendExport('cad',name,'dxf','application/octet-stream','Floor plan exported as DXF!');
        break;
      case 'obj':
        await _exportOBJ(name);
        break;
      case 'stl':
        await _backendExport('stl',name,'stl','application/octet-stream','3D model exported as STL!');
        break;
      case 'gltf':
        await _backendExport('gltf',name,'glb','model/gltf-binary','3D model exported as GLB!');
        break;
      default:
        showToast(`Unknown export format: ${format}`,'error');
    }
  }

  // OBJ export: backend returns { obj, mtl, filename } — download both files
  async function _exportOBJ(name){
    try{
      showLoading('Generating OBJ model…');
      const resp=await fetch('http://localhost:3001/api/architecture/export/obj',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(projectData)});
      if(!resp.ok){const err=await resp.json().catch(()=>({}));throw new Error(err.message||'OBJ export failed');}
      const data=await resp.json();
      const base=data.filename||name;
      // Download .obj
      _triggerDownload(URL.createObjectURL(new Blob([data.obj],{type:'text/plain'})),`${base}.obj`);
      // Download .mtl after a brief delay so both save dialogs don't overlap
      setTimeout(()=>{
        _triggerDownload(URL.createObjectURL(new Blob([data.mtl],{type:'text/plain'})),`${base}.mtl`);
      },400);
      showToast('3D model exported as OBJ + MTL!','success');
    }catch(e){
      console.error(e);
      showToast('OBJ export failed — is the AI backend running on port 3001?','error');
    }finally{ hideLoading(); }
  }

  // ── SVG floor-plan generator (client-side) ───────────────────
  function _generateSVG(){
    const SCALE=20,PAD=50;
    const W=projectData.totalWidth*SCALE+PAD*2;
    const H=projectData.totalDepth*SCALE+PAD*2;
    const floor=projectData.floors[activeFloorIdx]||{rooms:[]};
    const style=projectData.style||'modern';
    const isDark=style==='modern'||style==='luxury';
    const bg=isDark?'#141824':'#e8ecf1';
    const boundaryStroke=style==='luxury'?'#c9a84c':'#5b7cfa';

    let entities='';

    // Boundary
    entities+=`<rect x="${PAD}" y="${PAD}" width="${projectData.totalWidth*SCALE}" height="${projectData.totalDepth*SCALE}" fill="none" stroke="${boundaryStroke}" stroke-width="2.5"/>`;

    // Dimension labels
    const dimCol=isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)';
    entities+=`<text x="${PAD+projectData.totalWidth*SCALE/2}" y="${PAD-12}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="${dimCol}">${projectData.totalWidth}m</text>`;
    entities+=`<text x="${PAD-14}" y="${PAD+projectData.totalDepth*SCALE/2}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="${dimCol}" transform="rotate(-90,${PAD-14},${PAD+projectData.totalDepth*SCALE/2})">${projectData.totalDepth}m</text>`;

    // Rooms
    (floor.rooms||[]).forEach(room=>{
      const rc=ROOM_COLORS[room.type]||ROOM_COLORS.other;
      const rx=PAD+room.x*SCALE, ry=PAD+room.z*SCALE;
      const rw=room.width*SCALE, rh=room.depth*SCALE;
      entities+=`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${rc.bg}" stroke="${rc.border}" stroke-width="1.5"/>`;
      if(rw>30&&rh>22){
        const textCol=isDark?'#e2e8f0':'#1a1a2e';
        entities+=`<text x="${rx+rw/2}" y="${ry+rh/2-5}" text-anchor="middle" font-family="Inter,sans-serif" font-size="${Math.min(11,rw/(room.name.length*0.6))}" fill="${textCol}" font-weight="600">${room.name}</text>`;
        entities+=`<text x="${rx+rw/2}" y="${ry+rh/2+9}" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" fill="${dimCol}">${room.width}x${room.depth}m</text>`;
      }
      // Doors
      (room.doors||[]).forEach(door=>{
        const dw=Math.max(14,(door.width||0.9)*SCALE),pos=door.pos??0.5;
        let dx,dy,isH;
        if(door.wall==='top'||door.wall==='bottom'){
          dx=rx+pos*rw;dy=door.wall==='top'?ry:ry+rh;isH=true;
        } else {
          dx=door.wall==='left'?rx:rx+rw;dy=ry+pos*rh;isH=false;
        }
        if(isH){entities+=`<line x1="${dx-dw/2}" y1="${dy}" x2="${dx+dw/2}" y2="${dy}" stroke="#ff8c00" stroke-width="2.5"/>`;}
        else{entities+=`<line x1="${dx}" y1="${dy-dw/2}" x2="${dx}" y2="${dy+dw/2}" stroke="#ff8c00" stroke-width="2.5"/>`;}
      });
      // Windows
      (room.windows||[]).forEach(win=>{
        const ww=Math.max(12,(win.width||1.0)*SCALE),pos=win.pos??0.5;
        let wx,wy,isH;
        if(win.wall==='top'||win.wall==='bottom'){
          wx=rx+pos*rw;wy=win.wall==='top'?ry:ry+rh;isH=true;
        } else {
          wx=win.wall==='left'?rx:rx+rw;wy=ry+pos*rh;isH=false;
        }
        if(isH){entities+=`<line x1="${wx-ww/2}" y1="${wy}" x2="${wx+ww/2}" y2="${wy}" stroke="#56ccf2" stroke-width="3"/>`;}
        else{entities+=`<line x1="${wx}" y1="${wy-ww/2}" x2="${wx}" y2="${wy+ww/2}" stroke="#56ccf2" stroke-width="3"/>`;}
      });
    });

    const titleCol=isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.5)';
    const floorName=floor.name||`Floor ${activeFloorIdx+1}`;
    const title=`${projectData.name}  ·  ${floorName}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H+30}" viewBox="0 0 ${W} ${H+30}">
    <rect width="${W}" height="${H+30}" fill="${bg}"/>
    <text x="${W/2}" y="22" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" fill="${titleCol}" font-weight="600">${title}</text>
    <g transform="translate(0,6)">${entities}</g>
  </svg>`;
  }


  function autoLayout(){
    const floor=projectData.floors[activeFloorIdx];floor.rooms=[];
    const configs=[{type:'living',name:'Living Room',width:6,depth:5},{type:'kitchen',name:'Kitchen',width:4,depth:4},{type:'dining',name:'Dining Room',width:4,depth:4},{type:'bedroom',name:'Master Bedroom',width:5,depth:4},{type:'bedroom',name:'Bedroom 2',width:4,depth:4},{type:'bathroom',name:'Bathroom',width:3,depth:3}];
    let cx=0.5,cz=0.5,rowH=0;
    configs.forEach(c=>{
      if(cx+c.width>projectData.totalWidth-0.5){cx=0.5;cz+=rowH+0.5;rowH=0;}
      if(cz+c.depth<=projectData.totalDepth-0.5){floor.rooms.push({...c,x:cx,z:cz,height:floor.height||2.7,doors:[],windows:[]});cx+=c.width+0.5;rowH=Math.max(rowH,c.depth);}
    });
    selectedRoom=floor.rooms[0]||null;renderRooms();if(selectedRoom)showRoomProperties(selectedRoom);else hideRoomProperties();
    updateInfoPanel();drawFloorPlan();markUnsaved();showToast('Auto layout applied!','success');
  }
  function clearAll(){if(!confirm('Clear all rooms on this floor?'))return;projectData.floors[activeFloorIdx].rooms=[];selectedRoom=null;renderRooms();hideRoomProperties();updateInfoPanel();drawFloorPlan();markUnsaved();}

  // ── Overlap detection & fix ───────────────────────────────────────────────────
  function scanForOverlaps(){
    const floor=projectData.floors[activeFloorIdx];if(!floor)return false;
    const rooms=floor.rooms;
    for(let i=0;i<rooms.length;i++){
      for(let j=i+1;j<rooms.length;j++){
        if(roomsOverlap(rooms[i].x,rooms[i].z,rooms[i].width,rooms[i].depth,
                        rooms[j].x,rooms[j].z,rooms[j].width,rooms[j].depth,0)){
          return true;
        }
      }
    }
    return false;
  }

  function updateOverlapBtn(){
    const btn=el('fixOverlapsBtn');
    if(btn)btn.style.display=scanForOverlaps()?'flex':'none';
  }

  function fixOverlaps(){
    const floor=projectData.floors[activeFloorIdx];if(!floor)return;
    const keep=[],removed=[];
    for(const room of floor.rooms){
      const clash=keep.some(k=>roomsOverlap(room.x,room.z,room.width,room.depth,k.x,k.z,k.width,k.depth,0));
      if(clash)removed.push(room); else keep.push(room);
    }
    if(!removed.length){showToast('No overlapping rooms found','info');return;}
    floor.rooms=keep;
    if(removed.includes(selectedRoom)){selectedRoom=null;hideRoomProperties();}
    renderRooms();updateInfoPanel();drawFloorPlan();markUnsaved();
    updateOverlapBtn();
    showToast(`Removed ${removed.length} overlapping room${removed.length>1?'s':''}`, 'success');
  }
  function generateFloorPlan(){drawFloorPlan();showToast('Floor plan updated!','success');}
  function generate3DModel(){setView('interior');setTimeout(()=>setInteriorSubView('3dmodel'),80);}
  function generateInterior(){setView('interior');setTimeout(()=>setInteriorSubView('interior'),80);}

  // ── 3D View (FIXED floor alignment) ──────────────────────────
  function init3DView(){
    const container=el('threejsContainer');if(!container)return;
    if(container._cleanup){container._cleanup();delete container._cleanup;}
    if(_fpActive){deactivateFirstPerson();_fpActive=false;}
    _wireframeActive=false;
    while(container.firstChild)container.removeChild(container.firstChild);
    if(typeof THREE==='undefined'){container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#5b7cfa;font-size:1.1rem;flex-direction:column;gap:1rem;"><i class="fas fa-cube fa-3x"></i><span>Three.js unavailable</span></div>';return;}
    // Ensure container has layout dimensions before building scene
    requestAnimationFrame(()=>_build3DScene(container));
  }

  function _build3DScene(container){
    const W3=container.clientWidth||container.offsetWidth||800;
    const H3=container.clientHeight||container.offsetHeight||600;
    const style=projectData.style||'modern',S=STYLES[style];
    const openTop=el('openTopMode')?.checked!==false;
    const{totalWidth:W,totalDepth:D,floors}=projectData;
    const floorH=parseFloat(el('floorHeight')?.value)||floors[0]?.height||2.7;
    const numFloors=floors.length;
    const roofType=projectData.specifications?.roofType||'pitched';
    const scene=new THREE.Scene();scene.background=new THREE.Color(S.skyColor);
    window._3dScene=scene;
    if(style!=='minimalist')scene.fog=new THREE.FogExp2(S.skyColor,0.007);
    const aspect=W3/H3;
    const camera=new THREE.PerspectiveCamera(50,aspect,0.1,800);
    const dist=Math.max(W,D)*1.4+numFloors*floorH;
    camera.position.set(dist*0.7,dist*0.65,dist*0.7);
    let totalH=0;floors.forEach(f=>totalH+=f.height||floorH);
    camera.lookAt(0,totalH/2,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(W3,H3);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=style==='luxury'?0.9:style==='minimalist'?1.1:1.0;
    // Make canvas fill container exactly
    renderer.domElement.style.cssText='display:block;width:100%;height:100%;position:absolute;top:0;left:0;';
    container.appendChild(renderer.domElement);
    window._3dCamera=camera;window._3dRenderer=renderer;
    let controls=null;
    try{
      const OC=THREE.OrbitControls||(typeof OrbitControls!=='undefined'?OrbitControls:null);
      if(OC){controls=new OC(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.06;controls.target.set(0,totalH/2,0);controls.minDistance=3;controls.maxDistance=300;controls.update();window._3dControls=controls;}
      else{addSimpleOrbit(renderer.domElement,camera,totalH/2);}
    }catch(ex){addSimpleOrbit(renderer.domElement,camera,totalH/2);}
    scene.add(new THREE.AmbientLight(0xffffff,S.ambientInt));
    const sun=new THREE.DirectionalLight(style==='luxury'?0xffe8c0:style==='traditional'?0xfff5e0:0xffffff,1.0);
    sun.position.set(W*1.5,totalH*3+20,D*1.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    const sc=Math.max(W,D)+15;sun.shadow.camera.left=-sc;sun.shadow.camera.right=sc;sun.shadow.camera.top=sc;sun.shadow.camera.bottom=-sc;sun.shadow.camera.near=0.5;sun.shadow.camera.far=400;scene.add(sun);
    const fillLight=new THREE.DirectionalLight(0xaaccff,0.3);fillLight.position.set(-W,10,-D);scene.add(fillLight);
    if(style==='luxury'){const gold=new THREE.PointLight(0xffd700,0.8,40);gold.position.set(0,totalH+2,0);scene.add(gold);}
    const groundSize=Math.max(W,D)*4;
    const groundMat=style==='minimalist'?new THREE.MeshStandardMaterial({color:0xd8dce6,roughness:0.9}):style==='luxury'?new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.3,metalness:0.1}):new THREE.MeshStandardMaterial({color:S.groundColor,roughness:0.95});
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(groundSize,groundSize),groundMat);
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    if(style==='modern'||style==='minimalist'){const grid=new THREE.GridHelper(groundSize,Math.floor(groundSize/2),0x334466,0x222f44);grid.material.opacity=0.25;grid.material.transparent=true;scene.add(grid);}
    if(style==='traditional'||style==='luxury'){addTrees(scene,W,D,style);addHedges(scene,W,D,style);}
    if(style==='modern')addModernLandscape(scene,W,D);
    const slabMat=new THREE.MeshStandardMaterial({color:style==='luxury'?0x333333:0x888888,roughness:0.7});
    const slab=new THREE.Mesh(new THREE.BoxGeometry(W+0.6,0.2,D+0.6),slabMat);slab.position.set(0,-0.1,0);slab.receiveShadow=true;scene.add(slab);
    const wallMat=getWallMat(style),intWallMat=getInteriorWallMat(style);
    let baseY=0;
    floors.forEach((floor,floorIdx)=>{
      const thisFloorH=floor.height||floorH;
      const ox=-W/2,oz=-D/2;
      if(floorIdx>0){const sf=new THREE.Mesh(new THREE.BoxGeometry(W+0.1,0.25,D+0.1),slabMat);sf.position.set(0,baseY-0.125,0);sf.receiveShadow=true;scene.add(sf);}
      if(!openTop){const ceil=new THREE.Mesh(new THREE.BoxGeometry(W,0.12,D),new THREE.MeshStandardMaterial({color:0xdddddd,roughness:0.9}));ceil.position.set(0,baseY+thisFloorH-0.06,0);ceil.receiveShadow=true;scene.add(ceil);}
      const wt=0.22;
      [{w:W,d:wt,x:0,z:-D/2+wt/2},{w:W,d:wt,x:0,z:D/2-wt/2},{w:wt,d:D,x:-W/2+wt/2,z:0},{w:wt,d:D,x:W/2-wt/2,z:0}].forEach(({w:ew,d:ed,x,z})=>{
        const wall=new THREE.Mesh(new THREE.BoxGeometry(ew,thisFloorH,ed),wallMat);wall.position.set(x,baseY+thisFloorH/2,z);wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
      });
      if(style!=='minimalist')addWindows(scene,W,D,baseY,thisFloorH,style,floor);
      floor.rooms.forEach(room=>{
      // Clamp room bounds to building footprint to prevent overflow
      const clampedX = Math.max(0, room.x);
      const clampedZ = Math.max(0, room.z);
      const clampedW = Math.min(room.width, W - clampedX);
      const clampedD = Math.min(room.depth, D - clampedZ);
      const cx=ox+clampedX+clampedW/2,cz=oz+clampedZ+clampedD/2,roomH=room.height||thisFloorH;
      const rf=new THREE.Mesh(new THREE.BoxGeometry(clampedW-0.02,0.08,clampedD-0.02),getRoomFloorMat(style,room.type));rf.position.set(cx,baseY+0.04,cz);rf.receiveShadow=true;scene.add(rf);
      [{w:clampedW,d:0.1,x:cx,z:oz+clampedZ,isEdge:clampedZ<=0.01},{w:clampedW,d:0.1,x:cx,z:oz+clampedZ+clampedD,isEdge:clampedZ+clampedD>=D-0.01},{w:0.1,d:clampedD,x:ox+clampedX,z:cz,isEdge:clampedX<=0.01},{w:0.1,d:clampedD,x:ox+clampedX+clampedW,z:cz,isEdge:clampedX+clampedW>=W-0.01}].forEach(({w:iw,d:id,x,z,isEdge})=>{
        if(!isEdge){const iwm=new THREE.Mesh(new THREE.BoxGeometry(iw,roomH,id),intWallMat);iwm.position.set(x,baseY+roomH/2,z);iwm.castShadow=true;iwm.receiveShadow=true;scene.add(iwm);}
      });
      const rl=new THREE.PointLight(0xfff5e0,0.35,Math.max(room.width,room.depth)*1.8);rl.position.set(cx,baseY+roomH-0.4,cz);scene.add(rl);
        (room.doors||[]).forEach(door=>addDoorElement3D(scene,room,door,ox,oz,baseY,style));
        (room.windows||[]).forEach(win=>addWindowElement3D(scene,room,win,ox,oz,baseY,thisFloorH,style));
      });
      if(floors.length>1)addFloorLabel(scene,floor,floorIdx,baseY,W,D,thisFloorH);
      if(floors.length>1&&floorIdx<floors.length-1)addStaircase(scene,W,D,baseY,thisFloorH,style);
      // Also render any staircase rooms placed via the staircase tool
      floor.rooms.filter(r=>r.type==='staircase').forEach(room=>{
        const cx=ox+room.x+room.width/2,cz=oz+room.z+room.depth/2;
        addStaircase(scene,room.width,room.depth,baseY,room.height||thisFloorH,style,cx,cz);
      });
      baseY+=thisFloorH;
    });
    if(!openTop){buildRoof(scene,roofType,W,D,totalH,style);}
    else{const ph=totalH,parapetH=0.35;[{w:W+0.4,d:0.2,x:0,z:-D/2},{w:W+0.4,d:0.2,x:0,z:D/2},{w:0.2,d:D,x:-W/2,z:0},{w:0.2,d:D,x:W/2,z:0}].forEach(({w:pw,d:pd,x,z})=>{const p=new THREE.Mesh(new THREE.BoxGeometry(pw,parapetH,pd),wallMat);p.position.set(x,ph+parapetH/2,z);p.castShadow=true;scene.add(p);});}
    addDoorFrame(scene,W,D,0,floors[0]?.height||floorH,style);
    let animId;function animate(){animId=requestAnimationFrame(animate);if(controls)controls.update();renderer.render(scene,camera);}animate();
    const onR=()=>{const nw=container.clientWidth||800,nh=container.clientHeight||600;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);};
    window.addEventListener('resize',onR);
    container._cleanup=()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',onR);if(controls&&controls.dispose)controls.dispose();renderer.dispose();};
  }

  function addSimpleOrbit(domEl,camera,targetY){
    let drag=false,px=0,py=0,theta=0.7,phi=0.6,radius=camera.position.length();
    domEl.addEventListener('mousedown',e=>{drag=true;px=e.clientX;py=e.clientY;});
    domEl.addEventListener('mousemove',e=>{if(!drag)return;theta-=(e.clientX-px)*0.01;phi=Math.max(0.1,Math.min(1.4,phi-(e.clientY-py)*0.01));px=e.clientX;py=e.clientY;camera.position.set(Math.sin(theta)*Math.cos(phi)*radius,Math.sin(phi)*radius,Math.cos(theta)*Math.cos(phi)*radius);camera.lookAt(0,targetY,0);});
    domEl.addEventListener('mouseup',()=>drag=false);
    domEl.addEventListener('wheel',e=>{radius=Math.max(5,Math.min(300,radius+e.deltaY*0.1));camera.position.multiplyScalar(radius/camera.position.length());});
  }

  function addDoorElement3D(scene,room,door,ox,oz,baseY,style){
    const doorH=2.1,doorW=door.width||0.9,wallT=0.24;
    const pos=door.pos??0.5;
    const frameMat=stdMat(style==='luxury'?0xaa8800:style==='traditional'?0x8b4513:0x444444,0.5,0.2);
    const doorMat=stdMat(style==='traditional'?0x5c3317:style==='luxury'?0x0d0d1a:0x1a2040,0.6,0);
    const voidMat=new THREE.MeshStandardMaterial({color:0x050508,roughness:1});
    const wall=door.wall;
    const isHoriz=wall==='top'||wall==='bottom';
    let dx,dz;
    switch(wall){case'top':dx=ox+room.x+pos*room.width;dz=oz+room.z;break;case'bottom':dx=ox+room.x+pos*room.width;dz=oz+room.z+room.depth;break;case'left':dx=ox+room.x;dz=oz+room.z+pos*room.depth;break;case'right':dx=ox+room.x+room.width;dz=oz+room.z+pos*room.depth;break;default:return;}
    // Dark void to simulate opening
    const vW=isHoriz?doorW:wallT+0.02,vD=isHoriz?wallT+0.02:doorW;
    const voidM=new THREE.Mesh(new THREE.BoxGeometry(vW,doorH,vD),voidMat);
    voidM.position.set(dx,baseY+doorH/2,dz);scene.add(voidM);
    // Frame: top bar + two side uprights, oriented along wall
    const fW=isHoriz?doorW+0.16:wallT+0.06,fD=isHoriz?wallT+0.06:doorW+0.16;
    const topBar=new THREE.Mesh(new THREE.BoxGeometry(fW,0.1,fD),frameMat);
    topBar.position.set(dx,baseY+doorH+0.05,dz);scene.add(topBar);
    [-1,1].forEach(s=>{
      const upW=isHoriz?0.09:fW,upD=isHoriz?fD:0.09;
      const up=new THREE.Mesh(new THREE.BoxGeometry(upW,doorH,upD),frameMat);
      up.position.set(dx+(isHoriz?s*(doorW/2+0.045):0),baseY+doorH/2,dz+(isHoriz?0:s*(doorW/2+0.045)));
      scene.add(up);
    });
    // Door panel — slightly open (rotated ~30°)
    const panelW=isHoriz?doorW-0.05:0.06,panelD=isHoriz?0.06:doorW-0.05;
    const panel=new THREE.Mesh(new THREE.BoxGeometry(panelW,doorH-0.06,panelD),doorMat);
    const pivot=new THREE.Object3D();
    pivot.position.set(dx+(isHoriz?-(doorW/2-0.03):0),baseY+doorH/2,dz+(isHoriz?0:-(doorW/2-0.03)));
    panel.position.set(isHoriz?doorW/2-0.03:0,0,isHoriz?0:doorW/2-0.03);
    pivot.rotation.y=isHoriz?-0.42:0.42;
    pivot.add(panel);scene.add(pivot);
  }

  function addWindowElement3D(scene,room,win,ox,oz,baseY,floorH,style){
    const winH=1.1,winW=win.width||1.0,wallT=0.24;
    const winY=baseY+floorH*0.55,pos=win.pos??0.5;
    const frameMat=stdMat(style==='luxury'?0x998800:style==='traditional'?0x8b4513:0x222244,0.5,0.15);
    const glassMat=new THREE.MeshStandardMaterial({color:style==='luxury'?0x99ccff:0x88eeff,roughness:0.05,metalness:0.1,transparent:true,opacity:0.38});
    const voidMat=new THREE.MeshStandardMaterial({color:0x050508,roughness:1});
    const wall=win.wall,isHoriz=wall==='top'||wall==='bottom';
    let wx,wz;
    switch(wall){case'top':wx=ox+room.x+pos*room.width;wz=oz+room.z;break;case'bottom':wx=ox+room.x+pos*room.width;wz=oz+room.z+room.depth;break;case'left':wx=ox+room.x;wz=oz+room.z+pos*room.depth;break;case'right':wx=ox+room.x+room.width;wz=oz+room.z+pos*room.depth;break;default:return;}
    // Void behind glass to simulate opening
    const vW=isHoriz?winW:wallT+0.02,vD=isHoriz?wallT+0.02:winW;
    const voidM=new THREE.Mesh(new THREE.BoxGeometry(vW,winH,vD),voidMat);
    voidM.position.set(wx,winY,wz);scene.add(voidM);
    // Frame: 4 bars (top, bottom, left, right) around opening
    const fW=isHoriz?winW+0.12:wallT+0.06,fD=isHoriz?wallT+0.06:winW+0.12;
    // Top & bottom bars
    [-1,1].forEach(s=>{
      const bar=new THREE.Mesh(new THREE.BoxGeometry(fW,0.07,fD),frameMat);
      bar.position.set(wx,winY+s*(winH/2+0.035),wz);scene.add(bar);
    });
    // Side uprights
    [-1,1].forEach(s=>{
      const upW=isHoriz?0.07:fW,upD=isHoriz?fD:0.07;
      const up=new THREE.Mesh(new THREE.BoxGeometry(upW,winH,upD),frameMat);
      up.position.set(wx+(isHoriz?s*(winW/2+0.035):0),winY,wz+(isHoriz?0:s*(winW/2+0.035)));
      scene.add(up);
    });
    // Centre cross-bar for realism
    const cbW=isHoriz?0.05:fW,cbD=isHoriz?fD:0.05;
    const cb=new THREE.Mesh(new THREE.BoxGeometry(cbW,0.05,cbD),frameMat);
    cb.position.set(wx,winY,wz);scene.add(cb);
    // Glass pane(s) — two panes split by cross-bar
    const glassW=isHoriz?winW-0.08:wallT*0.35,glassD=isHoriz?wallT*0.35:winW-0.08;
    [-0.5,0.5].forEach(offset=>{
      const g=new THREE.Mesh(new THREE.BoxGeometry(glassW,winH/2-0.05,glassD),glassMat);
      g.position.set(wx,winY+offset*(winH/2-0.03),wz);scene.add(g);
    });
  }

  function stdMat(color,roughness=0.7,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
  function getWallMat(style){return({minimalist:stdMat(0xfafafa,0.85,0),traditional:stdMat(0xc8997a,0.9,0),luxury:stdMat(0x222222,0.4,0.1)})[style]||stdMat(0x3a4a6b,0.75,0.05);}
  function getInteriorWallMat(style){return({minimalist:stdMat(0xf0f0f0,0.9,0),traditional:stdMat(0xeadcc8,0.85,0),luxury:stdMat(0x1a1a2e,0.5,0.15)})[style]||stdMat(0xd0d8e8,0.8,0);}
  function getFloorMat(style){return({minimalist:stdMat(0xe8e8e8,0.7,0),traditional:stdMat(0x8b6f47,0.8,0),luxury:stdMat(0xc0b090,0.3,0.2)})[style]||stdMat(0x556070,0.6,0.1);}
  function getRoomFloorMat(style,roomType){const fb={bathroom:{minimalist:0xf0f0f0,traditional:0xe8e0d0,luxury:0xd4c9aa,modern:0x90a0b0},kitchen:{minimalist:0xe0e0e0,traditional:0xc8b898,luxury:0xbcab8a,modern:0x607080}}[roomType];if(fb)return stdMat(fb[style]||fb.modern,0.5,style==='luxury'?0.3:0);return getFloorMat(style);}

  function addWindows(scene,W,D,baseY,floorH,style,floor){
    // If user has explicitly placed windows on this floor, skip auto-windows to avoid doubling
    const userWinCount=(floor?.rooms||[]).reduce((s,r)=>s+(r.windows||[]).length,0);
    if(userWinCount>0)return;
    const winW=1.2,winH=1.1,frameT=0.12,winY=baseY+floorH*0.55;
    const frameMat=stdMat(style==='luxury'?0xaa8800:style==='traditional'?0x8b4513:0x222222,0.5,0.2);
    const glassMat=new THREE.MeshStandardMaterial({color:0x88ccff,roughness:0.05,metalness:0.1,transparent:true,opacity:0.35});
    for(let xi=-W/2+2.5;xi<W/2-1.5;xi+=3.5){[-D/2+0.12,D/2-0.12].forEach(wz=>{const f=new THREE.Mesh(new THREE.BoxGeometry(winW+0.1,winH+0.1,frameT),frameMat);f.position.set(xi,winY,wz);scene.add(f);const g=new THREE.Mesh(new THREE.BoxGeometry(winW,winH,frameT*0.3),glassMat);g.position.set(xi,winY,wz);scene.add(g);});}
    for(let zi=-D/2+2.5;zi<D/2-1.5;zi+=3.5){[-W/2+0.12,W/2-0.12].forEach(wx=>{const f=new THREE.Mesh(new THREE.BoxGeometry(frameT,winH+0.1,winW+0.1),frameMat);f.position.set(wx,winY,zi);scene.add(f);const g=new THREE.Mesh(new THREE.BoxGeometry(frameT*0.3,winH,winW),glassMat);g.position.set(wx,winY,zi);scene.add(g);});}
  }

  function addDoorFrame(scene,W,D,baseY,floorH,style){
    const frameMat=stdMat(style==='luxury'?0xaa8800:style==='traditional'?0x8b4513:0x222222,0.5,0.2);
    const doorMat=stdMat(style==='traditional'?0x5c3317:style==='luxury'?0x0d0d0d:0x1a1a2e,0.6,0);
    const doorW=1.0,doorH=2.2,doorZ=-D/2+0.1;
    const frameM=new THREE.Mesh(new THREE.BoxGeometry(doorW+0.2,doorH+0.15,0.15),frameMat);
    frameM.position.set(0,baseY+doorH/2,doorZ);scene.add(frameM);
    const doorM=new THREE.Mesh(new THREE.BoxGeometry(doorW,doorH,0.07),doorMat);
    doorM.position.set(0,baseY+doorH/2,doorZ);scene.add(doorM);
  }

  function buildRoof(scene,roofType,W,D,topY,style){
    const roofMat=stdMat(STYLES[style].roofColor,style==='luxury'?0.3:0.7,style==='modern'?0.2:0),overhang=0.5;
    if(roofType==='flat'){const r=new THREE.Mesh(new THREE.BoxGeometry(W+overhang*2,0.3,D+overhang*2),roofMat);r.position.set(0,topY+0.15,0);r.castShadow=true;scene.add(r);}
    else if(roofType==='hip'){const g=new THREE.ConeGeometry(Math.max(W,D)*0.72,3,4);const r=new THREE.Mesh(g,roofMat);r.position.set(0,topY+1.5,0);r.rotation.y=Math.PI/4;r.castShadow=true;scene.add(r);}
    else{buildGableRoof(scene,W,D,topY,roofMat,overhang);}
  }

  function buildGableRoof(scene,W,D,topY,roofMat,overhang){
    const rh=Math.min(W,D)*0.35,pitch=Math.sqrt(Math.pow(W/2+overhang,2)+Math.pow(rh,2)),angle=Math.atan2(rh,W/2+overhang);
    [-1,1].forEach(side=>{const p=new THREE.Mesh(new THREE.BoxGeometry(pitch,0.2,D+overhang*2),roofMat);p.position.set(side*(W/4),topY+rh/2,0);p.rotation.z=side*-angle;p.castShadow=true;scene.add(p);});
    const tri=new THREE.Shape();tri.moveTo(-W/2-overhang,0);tri.lineTo(W/2+overhang,0);tri.lineTo(0,rh);tri.closePath();
    const triGeo=new THREE.ShapeGeometry(tri);
    [-D/2-overhang,D/2+overhang].forEach(z=>{const t=new THREE.Mesh(triGeo,roofMat);t.position.set(0,topY,z);scene.add(t);});
  }

  function addTrees(scene,W,D,style){
    const trunkMat=stdMat(0x3a2510,0.95),leafColor=style==='luxury'?0x1a4a2e:0x2a6c2a;
    [[-W/2-3,-D/2-3],[W/2+3,-D/2-3],[-W/2-3,D/2+3],[W/2+3,D/2+3],[0,-D/2-4]].forEach(([x,z])=>{
      const h=4+Math.random()*2;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,h*0.35,7),trunkMat);trunk.position.set(x,h*0.175,z);trunk.castShadow=true;scene.add(trunk);
      [0,h*0.2,h*0.38].forEach((yOff,i)=>{const r=1.4-i*0.35;const leaf=new THREE.Mesh(new THREE.ConeGeometry(r,h*0.3,8),stdMat(leafColor+i*0x001100,0.9));leaf.position.set(x,h*0.35+yOff,z);leaf.castShadow=true;scene.add(leaf);});
    });
  }
  function addHedges(scene,W,D,style){
    const hedgeMat=stdMat(style==='luxury'?0x0a3a1a:0x2a5a2a,0.9);
    [-W/2-1,W/2+1].forEach(hx=>{const h=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.8,D+2),hedgeMat);h.position.set(hx,0.4,0);h.castShadow=true;scene.add(h);});
  }
  function addModernLandscape(scene,W,D){
    const path=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.05,D/2+2),stdMat(0x4a5568,0.7));path.position.set(0,0.025,-D/2-1);scene.add(path);
    [-W/2-1,W/2+1].forEach(gx=>{const g=new THREE.Mesh(new THREE.BoxGeometry(2,0.05,D+4),stdMat(0x778899,0.95));g.position.set(gx,0.025,0);scene.add(g);});
  }
  function addFloorLabel(scene,floor,floorIdx,baseY,W,D,floorH){
    const c=document.createElement('canvas');c.width=256;c.height=48;
    const ctx=c.getContext('2d');ctx.fillStyle='rgba(91,124,250,0.85)';ctx.fillRect(0,0,256,48);
    ctx.fillStyle='#fff';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(floor.name||`Floor ${floorIdx+1}`,128,24);
    const tex=new THREE.CanvasTexture(c);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
    sp.scale.set(4,0.75,1);sp.position.set(-W/2-3,baseY+floorH/2,0);scene.add(sp);
  }

  // ── Staircase Renderer ───────────────────────────────────────
  function addStaircase(scene,W,D,baseY,floorH,style,cx,cz){
    const stepCount=Math.max(8,Math.ceil(floorH/0.18));
    const stepH=floorH/stepCount,stepD=0.28,stairW=1.1;
    const totalDepth=stepCount*stepD;
    const mat=stdMat(style==='luxury'?0xc0b090:style==='traditional'?0x8b6f47:style==='minimalist'?0xe0e0e0:0x607080,0.7,style==='luxury'?0.2:0);
    const railMat=stdMat(style==='luxury'?0xaa8800:style==='traditional'?0x4a2800:0x334466,0.5,style==='luxury'?0.4:0.1);
    // Place in given centre or default to near-corner
    const sx=(cx!==undefined?cx-stairW/2:-W/2+0.5);
    const sz=(cz!==undefined?cz-totalDepth/2:-D/2+0.5);
    for(let i=0;i<stepCount;i++){
      const step=new THREE.Mesh(new THREE.BoxGeometry(stairW,stepH,stepD),mat);
      step.position.set(sx+stairW/2,baseY+stepH/2+i*stepH,sz+i*stepD+stepD/2);
      step.castShadow=true;step.receiveShadow=true;scene.add(step);
    }
    for(let i=0;i<=stepCount;i+=3){
      const post=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.9,0.06),railMat);
      post.position.set(sx+stairW+0.03,baseY+i*stepH+0.45,sz+i*stepD);
      post.castShadow=true;scene.add(post);
      const postL=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.9,0.06),railMat);
      postL.position.set(sx-0.03,baseY+i*stepH+0.45,sz+i*stepD);
      postL.castShadow=true;scene.add(postL);
    }
    const railLen=Math.sqrt(totalDepth*totalDepth+floorH*floorH);
    const railAngle=Math.atan2(floorH,totalDepth);
    [sx+stairW+0.03,sx-0.03].forEach(rx=>{
      const rail=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,railLen),railMat);
      rail.position.set(rx,baseY+floorH/2+0.9,sz+totalDepth/2);
      rail.rotation.x=railAngle;rail.castShadow=true;scene.add(rail);
    });
  }

  // ── Wireframe Toggle ─────────────────────────────────────────
  let _wireframeActive = false;

  function toggleWireframe(){

    _wireframeActive = !_wireframeActive;

    // update BOTH possible buttons
    const btn1 = document.getElementById('wireframeBtn2');
    const btn2 = document.getElementById('wireframeToggleBtn');
    const btn3 = document.getElementById('wireframeTopBtn'); 

    if(btn1) btn1.classList.toggle('active', _wireframeActive);
    if(btn2) btn2.classList.toggle('active', _wireframeActive);
    if(btn3) btn3.classList.toggle('active', _wireframeActive);

    // access 3D scene
    const sceneRef = window._3dScene || window._interiorScene;

    if(sceneRef){
      sceneRef.traverse(obj=>{
        if(obj.isMesh && obj.material){
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m=>{
            m.wireframe = _wireframeActive;
          });
        }
      });
    }
  }

  window.toggleWireframe = toggleWireframe;

  // ══════════════════════════════════════════════════════════════
  //  FIRST-PERSON GHOST WALK  (full rewrite)
  //  • True human eye height (1.65 m above floor)
  //  • Ghost movement — passes through walls freely
  //  • Multi-floor navigation: Q/E or PgUp/PgDn
  //  • Pointer-lock for immersive mouse look (fallback: hold RMB)
  //  • On-screen HUD: floor name + room name + controls hint
  //  • interior.js orbit suppressed via window._fpMode flag
  // ══════════════════════════════════════════════════════════════
  const FP_EYE_HEIGHT = 1.65;   // metres above current floor base
  const FP_SPEED      = 0.08;   // movement units per frame
  const FP_SPRINT     = 0.20;   // sprint (Shift held)
  const FP_PITCH_LIM  = 1.35;   // ~77° up/down clamp

  let _fpActive = false, _fpControls = null;

  function toggleFirstPerson(){
    if(typeof THREE==='undefined')return;
    _fpActive = !_fpActive;
    ['fpCameraBtn','fpBtn2','walkTopBtn'].forEach(id=>{const b=el(id);if(b)b.classList.toggle('active',_fpActive);});

    // Show / hide crosshair and orbit hint
    const xhair = document.getElementById('fpCrosshair');
    const hint  = document.getElementById('interiorOrbitHint');
    if(xhair) xhair.style.display = _fpActive ? 'block' : 'none';
    if(hint)  hint.style.display  = _fpActive ? 'none'  : '';

    if(_fpActive){
      // Make sure we are in interior view so the interior scene/camera exist
      if(currentView!=='interior'){
        setView('interior');
        setTimeout(activateFirstPerson, 350);  // wait for interior.js to init
      } else {
        activateFirstPerson();
      }
    } else {
      deactivateFirstPerson();
    }
  }
  window.toggleFirstPerson = toggleFirstPerson;

  // ── Build or update FP HUD overlay ──────────────────────────
  function _fpGetOrCreateHUD(){
    let hud = document.getElementById('_fpHUD');
    if(!hud){
      hud = document.createElement('div');
      hud.id = '_fpHUD';
      hud.style.cssText = [
        'position:absolute','top:12px','left:50%','transform:translateX(-50%)',
        'background:rgba(5,8,18,0.78)','color:#c8d8f0','font:600 13px/1.5 monospace',
        'padding:7px 18px','border-radius:10px','border:1px solid rgba(91,124,250,0.35)',
        'pointer-events:none','z-index:9999','text-align:center','backdrop-filter:blur(4px)',
        'min-width:260px','letter-spacing:.03em','transition:opacity .3s'
      ].join(';');
      const cont = document.getElementById('interiorContainer') || document.body;
      cont.style.position = 'relative';
      cont.appendChild(hud);
    }
    return hud;
  }

  function _fpUpdateHUD(state){
    const hud = _fpGetOrCreateHUD();
    const pd  = window.projectData;
    if(!pd){ hud.innerHTML=''; return; }

    const floors = pd.floors || [];
    const fi     = Math.max(0, Math.min(state.floorIdx, floors.length-1));
    const floor  = floors[fi] || {};
    const floorName = floor.name || `Floor ${fi+1}`;

    // Detect which room the camera is roughly in
    const cam = window._interiorCamera;
    let roomName = '';
    if(cam && floor.rooms){
      const ox = -pd.totalWidth/2, oz = -pd.totalDepth/2;
      const lx = cam.position.x - ox, lz = cam.position.z - oz;
      const hit = floor.rooms.find(r=>lx>=r.x&&lx<=r.x+r.width&&lz>=r.z&&lz<=r.z+r.depth);
      if(hit) roomName = hit.name || hit.type || '';
    }

    const lockTip = document.pointerLockElement ? 'Move mouse to look · Esc to exit' : 'Click canvas to lock mouse · RMB-drag to look';
    hud.innerHTML =
      `<span style="color:#5b7cfa"><i class="fas fa-person-walking"></i> Walk Mode</span> &nbsp;|&nbsp; `+
      `<span style="color:#7ec8e3">${floorName}</span>`+
      (roomName ? ` &nbsp;·&nbsp; <span style="color:#aaa">${roomName}</span>` : '')+
      `<br><small style="opacity:.65;font-size:10px">WASD move · Q/E floor · Shift sprint · ${lockTip}</small>`;
  }

  // ── Main activation ──────────────────────────────────────────
  function activateFirstPerson(){
    const cam   = window._interiorCamera || window._3dCamera;
    const domEl = (window._interiorRenderer || window._3dRenderer)?.domElement;
    if(!cam || !domEl){ showToast('Switch to Interior view first, then press Walk.','info'); _fpActive=false; return; }

    const pd     = window.projectData;
    const floors = pd.floors || [{height:2.7,rooms:[]}];

    // Build cumulative floor base Y positions (same as interior.js: baseY starts at 0.22)
    const SLAB = 0.22;
    const floorBases = [];
    let yAcc = SLAB;
    floors.forEach(f=>{ floorBases.push(yAcc); yAcc += (f.height||2.7); });

    // State object — all mutable FP state lives here
    const state = {
      floorIdx : 0,
      yaw      : 0,
      pitch    : 0,
      moveF    : false, moveB: false, moveL: false, moveR: false,
      moveUp   : false, moveDn: false,   // Q / E
      sprint   : false,
      // RMB drag fallback (when pointer lock not supported/denied)
      rmbDown  : false, rmbLX: 0, rmbLY: 0,
    };

    // Place camera at centre of building, eye height above ground floor
    cam.position.set(0, floorBases[0] + FP_EYE_HEIGHT, (pd.totalDepth||15)/4);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(0, 0, 0);

    // Tell interior.js to stop moving the camera
    window._fpMode = true;

    // ── Pointer lock (click canvas to engage) ──
    const reqLock = ()=>{ try{ domEl.requestPointerLock(); }catch(e){} };
    domEl.addEventListener('click', reqLock);

    const onPLChange = ()=>{
      // Nothing extra needed; mouse move handler checks document.pointerLockElement
    };
    document.addEventListener('pointerlockchange', onPLChange);

    // ── Mouse move (pointer lock OR RMB drag) ──
    const onMouseMove = e=>{
      let dx=0, dy=0;
      if(document.pointerLockElement === domEl){
        dx = e.movementX; dy = e.movementY;
      } else if(state.rmbDown){
        dx = e.clientX - state.rmbLX; dy = e.clientY - state.rmbLY;
        state.rmbLX = e.clientX; state.rmbLY = e.clientY;
      } else return;
      state.yaw   -= dx * 0.0025;
      state.pitch  = Math.max(-FP_PITCH_LIM, Math.min(FP_PITCH_LIM, state.pitch - dy * 0.0025));
      cam.rotation.y = state.yaw;
      cam.rotation.x = state.pitch;
      _fpUpdateHUD(state);
    };

    const onMouseDown = e=>{ if(e.button===2){ state.rmbDown=true; state.rmbLX=e.clientX; state.rmbLY=e.clientY; } };
    const onMouseUp   = e=>{ if(e.button===2) state.rmbDown=false; };
    const onCtxMenu   = e=>e.preventDefault();

    // ── Keyboard ──
    const onKeyDown = e=>{
      switch(e.key){
        case 'w': case 'W': case 'ArrowUp':    state.moveF=true; break;
        case 's': case 'S': case 'ArrowDown':  state.moveB=true; break;
        case 'a': case 'A': case 'ArrowLeft':  state.moveL=true; break;
        case 'd': case 'D': case 'ArrowRight': state.moveR=true; break;
        case 'q': case 'Q': case 'PageUp':     state.moveUp=true;  break;
        case 'e': case 'E': case 'PageDown':   state.moveDn=true;  break;
        case 'Shift': state.sprint=true; break;
        case 'Escape':
          _fpActive=false;
          ['fpCameraBtn','fpBtn2'].forEach(id=>{const b=el(id);if(b)b.classList.remove('active');});
          deactivateFirstPerson();
          break;
      }
    };
    const onKeyUp = e=>{
      switch(e.key){
        case 'w': case 'W': case 'ArrowUp':    state.moveF=false; break;
        case 's': case 'S': case 'ArrowDown':  state.moveB=false; break;
        case 'a': case 'A': case 'ArrowLeft':  state.moveL=false; break;
        case 'd': case 'D': case 'ArrowRight': state.moveR=false; break;
        case 'q': case 'Q': case 'PageUp':     state.moveUp=false; break;
        case 'e': case 'E': case 'PageDown':   state.moveDn=false; break;
        case 'Shift': state.sprint=false; break;
      }
    };

    // ── Per-frame update (ghost movement) ──
    const fpUpdate = ()=>{
      if(!_fpActive) return;

      const spd = state.sprint ? FP_SPRINT : FP_SPEED;

      // Horizontal movement — ghost ignores walls
      const dir = new THREE.Vector3();
      if(state.moveF) dir.z -= spd;
      if(state.moveB) dir.z += spd;
      if(state.moveL) dir.x -= spd;
      if(state.moveR) dir.x += spd;
      dir.applyEuler(new THREE.Euler(0, state.yaw, 0));
      cam.position.x += dir.x;
      cam.position.z += dir.z;

      // Floor navigation: Q goes up one floor, E goes down
      const totalFloors = floors.length;
      if(state.moveUp && !state._lastUp){
        state.floorIdx = Math.min(totalFloors-1, state.floorIdx+1);
        state._lastUp = true;
        _fpSnapToFloor(cam, state, floorBases, floors);
      }
      if(!state.moveUp) state._lastUp = false;
      if(state.moveDn && !state._lastDn){
        state.floorIdx = Math.max(0, state.floorIdx-1);
        state._lastDn = true;
        _fpSnapToFloor(cam, state, floorBases, floors);
      }
      if(!state.moveDn) state._lastDn = false;

      // Lock eye height to current floor (human eye level = floor base + 1.65 m)
      const targetEyeY = floorBases[state.floorIdx] + FP_EYE_HEIGHT;
      cam.position.y += (targetEyeY - cam.position.y) * 0.18; // smooth snap

      // Soft boundary — ghost can peek slightly outside building but not fly away
      const halfW = (pd.totalWidth  || 20) / 2 + 2;
      const halfD = (pd.totalDepth  || 15) / 2 + 2;
      cam.position.x = Math.max(-halfW, Math.min(halfW, cam.position.x));
      cam.position.z = Math.max(-halfD, Math.min(halfD, cam.position.z));

      _fpUpdateHUD(state);
      _fpControls._raf = requestAnimationFrame(fpUpdate);
    };

    // Register listeners
    document.addEventListener('keydown',   onKeyDown);
    document.addEventListener('keyup',     onKeyUp);
    domEl.addEventListener('mousemove',    onMouseMove);
    domEl.addEventListener('mousedown',    onMouseDown);
    domEl.addEventListener('mouseup',      onMouseUp);
    domEl.addEventListener('contextmenu',  onCtxMenu);

    _fpControls = {
      onKeyDown, onKeyUp, onMouseMove, onMouseDown, onMouseUp, onCtxMenu,
      onPLChange, reqLock,
      _domEl : domEl,
      _raf   : requestAnimationFrame(fpUpdate),
    };

    _fpUpdateHUD(state);
    showToast('🚶‍♂️ Walk Mode — WASD move · Q/E floor · Shift sprint · click canvas to lock mouse · Esc exit', 'info');
  }

  // Snap camera Y to a new floor's eye height
  function _fpSnapToFloor(cam, state, floorBases, floors){
    const fi   = state.floorIdx;
    const base = floorBases[fi] || 0;
    cam.position.y = base + FP_EYE_HEIGHT;
  }

  function deactivateFirstPerson(){
    // Release pointer lock
    try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(e){}

    if(!_fpControls) return;
    cancelAnimationFrame(_fpControls._raf);

    document.removeEventListener('keydown',          _fpControls.onKeyDown);
    document.removeEventListener('keyup',            _fpControls.onKeyUp);
    document.removeEventListener('pointerlockchange',_fpControls.onPLChange);

    const domEl = _fpControls._domEl;
    if(domEl){
      domEl.removeEventListener('click',       _fpControls.reqLock);
      domEl.removeEventListener('mousemove',   _fpControls.onMouseMove);
      domEl.removeEventListener('mousedown',   _fpControls.onMouseDown);
      domEl.removeEventListener('mouseup',     _fpControls.onMouseUp);
      domEl.removeEventListener('contextmenu', _fpControls.onCtxMenu);
    }
    _fpControls = null;

    // Hand camera back to interior.js orbit
    window._fpMode = false;

    // Remove HUD
    const hud = document.getElementById('_fpHUD');
    if(hud) hud.remove();

    // Restore orbit hint, hide crosshair
    const xhair = document.getElementById('fpCrosshair');
    const hint  = document.getElementById('interiorOrbitHint');
    if(xhair) xhair.style.display = 'none';
    if(hint)  hint.style.display  = '';

    showToast('Walk mode exited — orbit restored.', 'info');
  }

  // ── Ollama Chat ──────────────────────────────────────────────
  // ── AI Chat — state ───────────────────────────────────────────
  // Keeps the last N turns so Ollama has conversational context
  const _chatHistory = [];   // [{role:'user'|'assistant', content:string}]
  const MAX_HISTORY  = 6;    // 3 user/assistant pairs

  function initOllamaChat(){
    const input=el('ollamaChatInput'), send=el('ollamaChatSend');
    if(!input||!send)return;
    send.addEventListener('click', sendOllamaMessage);
    input.addEventListener('keydown', e=>{
      if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendOllamaMessage(); }
    });
  }

  // ── Clear conversation ─────────────────────────────────────────
  function clearChat(){
    _chatHistory.length=0;
    const msgs=el('ollamaChatMessages');
    if(!msgs)return;
    msgs.innerHTML=`<div class="chat-msg ai">
      <div class="chat-bubble chat-welcome">
        <span class="chat-welcome-icon">&#127968;</span>
        <span>Conversation cleared. Tap a chip above for suggestions, or ask anything about your project.</span>
      </div>
    </div>`;
  }

  // ── Append a bubble to the chat ────────────────────────────────
  function _chatAppend(role, html, extraClass=''){
    const msgs=el('ollamaChatMessages');
    if(!msgs)return;
    const div=document.createElement('div');
    div.className=`chat-msg ${role}`;
    div.innerHTML=`<div class="chat-bubble ${extraClass}">${html}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop=msgs.scrollHeight;
    return div;
  }

  // ── Typing indicator ───────────────────────────────────────────
  function _chatTyping(){
    const id='typing_'+Date.now();
    const msgs=el('ollamaChatMessages');
    if(!msgs)return id;
    const div=document.createElement('div');
    div.className='chat-msg ai'; div.id=id;
    div.innerHTML='<div class="chat-bubble typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
    return id;
  }

  // ── Format AI reply: convert **bold**, numbered lists ──────────
  function _formatReply(text){
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/^(\d+)\.\s+/gm,'<br><strong style="color:#7ec8e3">$1.</strong> ')
      .replace(/^[-•]\s+/gm,'<br>• ')
      .replace(/\n{2,}/g,'<br><br>')
      .replace(/\n/g,'<br>')
      .replace(/^<br>/,'');
  }

  // ── Send a user message ────────────────────────────────────────
  async function sendOllamaMessage(){
    const input=el('ollamaChatInput');
    if(!input)return;
    const text=input.value.trim();
    if(!text)return;
    input.value='';

    _chatAppend('user', escapeHtml(text));
    const typingId=_chatTyping();

    try{
      const token = localStorage.getItem('token');
      const resp=await fetch(`${MAIN_API_URL}/api/ai/chat`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(token ? {'Authorization': `Bearer ${token}`} : {})
        },
        body:JSON.stringify({
          message:    text,
          projectData: projectData||null,
          history:    [..._chatHistory],
        }),
      });
      const data=await resp.json();

      document.getElementById(typingId)?.remove();

      // Handle plan limit errors
      if(!resp.ok){
        if(resp.status===403 && (data.code==='AI_LIMIT_REACHED'||data.code==='PLAN_REQUIRED'||data.code==='PLAN_EXPIRED')){
          _chatAppend('ai',
            `<div style="color:#f87171;"><i class="fas fa-lock" style="margin-right:6px;"></i><strong>AI message limit reached.</strong><br>
            You've used all your AI messages for this month on the <strong>${data.currentPlan||'free'}</strong> plan.<br>
            <button onclick="window.showPlanLimitModal('ai_chat','${data.currentPlan||'free'}')" 
              style="margin-top:8px;padding:6px 14px;background:linear-gradient(135deg,#00d4c8,#7c3aed);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">
              <i class="fas fa-arrow-up"></i> Upgrade Plan
            </button></div>`,
            'error'
          );
          return;
        }
        _chatAppend('ai', data.message || 'AI request failed.', 'error');
        return;
      }

      const reply=data.data?.reply||data.error||'No response.';
      _chatAppend('ai', _formatReply(reply));

      // Store in history for context on next turn  
      _chatHistory.push({role:'user',    content:text});
      _chatHistory.push({role:'assistant',content:reply});
      if(_chatHistory.length>MAX_HISTORY*2) _chatHistory.splice(0,2);
    }catch(err){
      document.getElementById(typingId)?.remove();
      _chatAppend('ai','AI backend offline. Start the AI server on port 3001.','error');
    }
  }

  // ── Request a proactive suggestion ────────────────────────────
  async function requestSuggestion(type){
    if(!projectData){ showToast('Load or create a project first','error'); return; }

    const chipClass={interior:'chip-interior',exterior:'chip-exterior',layout:'chip-layout',materials:'chip-materials'}[type];
    const chip=document.querySelector(`.${chipClass}`);

    // Show which chip is active
    document.querySelectorAll('.chat-chip').forEach(c=>c.classList.remove('active','loading'));
    if(chip){ chip.classList.add('active','loading'); }

    const labels={interior:'🛋️ Interior Suggestions',exterior:'🏠 Exterior Suggestions',layout:'📐 Layout Review',materials:'🪵 Materials & Finishes'};
    _chatAppend('user', escapeHtml(labels[type]||type));
    const typingId=_chatTyping();

    try{
      const token = localStorage.getItem('token');
      const resp=await fetch(`${MAIN_API_URL}/api/ai/suggest`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(token ? {'Authorization': `Bearer ${token}`} : {})
        },
        body:JSON.stringify({ type, projectData }),
      });
      const data=await resp.json();
      document.getElementById(typingId)?.remove();

      // Handle plan limit errors
      if(!resp.ok){
        if(resp.status===403 && (data.code==='AI_LIMIT_REACHED'||data.code==='PLAN_REQUIRED'||data.code==='PLAN_EXPIRED')){
          _chatAppend('ai',
            `<div style="color:#f87171;"><i class="fas fa-lock" style="margin-right:6px;"></i><strong>AI message limit reached.</strong><br>
            Upgrade your plan to get more AI suggestions.<br>
            <button onclick="window.showPlanLimitModal('ai_chat','${data.currentPlan||'free'}')" 
              style="margin-top:8px;padding:6px 14px;background:linear-gradient(135deg,#00d4c8,#7c3aed);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;">
              <i class="fas fa-arrow-up"></i> Upgrade Plan
            </button></div>`,
            'error'
          );
          return;
        }
        _chatAppend('ai', data.message || 'Suggestion request failed.', 'error');
        return;
      }

      const reply=data.data?.reply||data.error||'No suggestions returned.';

      // Render as suggestion card
      const html=`<div class="chat-suggestion-label"><i class="fas fa-lightbulb"></i> ${labels[type]||type}</div>${_formatReply(reply)}`;
      _chatAppend('ai', html, 'chat-suggestion-card');

      // Also add to history so follow-up questions reference it
      _chatHistory.push({role:'user',      content:`Give me ${type} suggestions for this project.`});
      _chatHistory.push({role:'assistant', content:reply});
      if(_chatHistory.length>MAX_HISTORY*2) _chatHistory.splice(0,2);
    }catch(err){
      document.getElementById(typingId)?.remove();
      _chatAppend('ai','AI backend offline. Start the AI server on port 3001.','error');
    }finally{
      if(chip){ chip.classList.remove('loading'); }
    }
  }

  function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');}

  async function generateAIArchitecture(){
    const req=el('aiArchReq');if(!req||!req.value.trim()){showToast('Please enter requirements','error');return;}
    const output=el('aiArchOutput');if(output)output.innerHTML='<div class="ai-loading"><i class="fas fa-spinner fa-spin"></i> Generating...</div>';
    try{
      // Parse free-text requirements into structured params for the BSP layout engine
      const text=req.value.toLowerCase();
      const floorMatch=text.match(/(\d+)\s*(?:floor|storey|story)/);
      const areaMatch=text.match(/(\d+)\s*(?:m2|sqm|m²|square)/);
      const bedMatch=text.match(/(\d+)\s*bed/);
      const bathMatch=text.match(/(\d+)\s*bath/);
      const rooms=[];
      if(bedMatch)rooms.push({type:'bedroom',count:parseInt(bedMatch[1])});
      if(bathMatch)rooms.push({type:'bathroom',count:parseInt(bathMatch[1])});
      if(/living/.test(text))rooms.push({type:'living',count:1});
      if(/kitchen/.test(text))rooms.push({type:'kitchen',count:1});
      if(/dining/.test(text))rooms.push({type:'dining',count:1});
      if(/office|study/.test(text))rooms.push({type:'office',count:1});
      if(/garage/.test(text))rooms.push({type:'garage',count:1});
      const params={
        buildingType:/office|commercial/.test(text)?'office':'residential',
        floors:floorMatch?parseInt(floorMatch[1]):1,
        totalArea:areaMatch?parseInt(areaMatch[1]):(projectData.totalWidth*projectData.totalDepth),
        rooms:rooms.length?rooms:[]
      };
      const resp=await fetch(`${AI_BACKEND_URL}/api/architecture/floorplan/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.message||'Generation failed');
      if(data.floorplan&&data.floorplan.floors){
        // Apply BSP-generated layout to projectData
        _applyBSPFloorplan(data.floorplan);
        if(output)output.innerHTML=`<div class="ai-result-ok"><i class="fas fa-check-circle"></i> ${data.floorplan.floors.reduce((s,f)=>s+f.rooms.length,0)} rooms generated across ${data.floorplan.floors.length} floor(s).</div>`;
      }else{
        const t=JSON.stringify(data,null,2);
        if(output)output.innerHTML=`<pre class="ai-result">${escapeHtml(t)}</pre>`;
      }
    }catch(e){if(output)output.innerHTML=`<div class="ai-error">AI backend not available on port 3001: ${escapeHtml(e.message)}</div>`;}
  }

  // Apply a BSP floorplan response (floors[].rooms[]) into projectData
  // BSP rooms use {x,y,width,height,type,label}; projectData rooms use {x,z,width,depth,type,name}
  function _applyBSPFloorplan(floorplan){
    if(!projectData||!floorplan||!floorplan.floors)return;
    if(!confirm('Apply AI-generated layout? This will replace current rooms.'))return;
    const bspFloors=floorplan.floors;
    // Resize house to match BSP footprint
    const f0=bspFloors[0];
    if(f0&&f0.width&&f0.height){
      projectData.totalWidth=f0.width;
      projectData.totalDepth=f0.height;
      if(el('totalWidth'))el('totalWidth').value=f0.width;
      if(el('totalDepth'))el('totalDepth').value=f0.height;
    }
    // Sync floor count
    const numFloors=bspFloors.length;
    if(el('numFloors'))el('numFloors').value=numFloors;
    while(projectData.floors.length<numFloors){
      const lvl=projectData.floors.length+1;
      projectData.floors.push({level:lvl,name:`Floor ${lvl}`,height:projectData.floors[0]?.height||2.7,rooms:[]});
    }
    while(projectData.floors.length>numFloors)projectData.floors.pop();
    // Map BSP rooms into projectData format
    bspFloors.forEach((bspFloor,fi)=>{
      const pdFloor=projectData.floors[fi];
      if(!pdFloor)return;
      pdFloor.rooms=(bspFloor.rooms||[]).map(r=>({
        name:r.label||r.type.charAt(0).toUpperCase()+r.type.slice(1),
        type:r.type,
        width:r.width,
        depth:r.height,   // BSP uses 'height' for Z-axis depth
        x:r.x,
        z:r.y,            // BSP uses 'y' for Z-axis position
        height:pdFloor.height||2.7,
        doors:[],
        windows:[]
      }));
    });
    activeFloorIdx=0;
    selectedRoom=null;
    updateFloorTabs();renderRooms();hideRoomProperties();updateInfoPanel();drawFloorPlan();markUnsaved();
    showToast(`BSP layout applied — ${bspFloors.reduce((s,f)=>s+(f.rooms||[]).length,0)} rooms across ${numFloors} floor(s)`,'success');
  }

  function setInteriorSubView(v){
    ['subInterior','subDollhouse','subExterior','sub3dmodel'].forEach(id=>{const b=el(id);if(b)b.classList.remove('active');});
    const tabId='sub'+(v==='3dmodel'?'3dmodel':v.charAt(0).toUpperCase()+v.slice(1));
    const btn=el(tabId);if(btn)btn.classList.add('active');
    // Wireframe + Walk are useful in ALL 3D sub-views
    if(el('wireframeToggleBtn'))el('wireframeToggleBtn').style.display='inline-flex';
    if(el('fpCameraBtn'))el('fpCameraBtn').style.display='inline-flex';
    // Open Top only relevant for 3D Model exterior view
    const is3d=v==='3dmodel';
    if(el('openTopToggle'))el('openTopToggle').style.display=is3d?'flex':'none';
    if(typeof window._setInteriorSubView==='function')window._setInteriorSubView(v);
  }

  Object.assign(window,{
    addRoom,addRoomOfType,addLift,setTool,setView,setStyle,
    zoomIn,zoomOut,resetZoom,refresh3D,
    saveProject,exportProject,showSettings:()=>{},
    generateFloorPlan,generate3DModel,generateInterior,
    autoLayout,clearAll,
    updateProjectTitle,updateProjectSettings,updateSnapSize,
    selectRoomByIndex,selectByIdx,deleteRoomByIndex,duplicateRoom,
    setInteriorSubView,toggleOpenTop:refresh3D,
    sendOllamaMessage,generateAIArchitecture,_applyBSPFloorplan,
    clearRoomDoors,clearRoomWindows,
    toggleWireframe,toggleFirstPerson,
    placeStaircaseAt,
    undo,redo,viewFloor,updateFloorIsoButtons,
    requestSuggestion, clearChat,
  });

  // expose functions globally for HTML
  window.setTool = setTool;
  window.setView = setView;
  window.generate3DModel = generate3DModel;               
  window.generateAIArchitecture = generateAIArchitecture;