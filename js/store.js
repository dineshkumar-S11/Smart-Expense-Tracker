/* Store: finance records are persisted by Flask/MySQL. Only preferences remain in localStorage. */
const Store = (() => {
  const BASE = 'smartExpenseTracker.v1.';
  let PREFIX = BASE, account = null;
  const mem = {};
  const DEFAULT_CATEGORIES = {
    Expense: [
      {name:'Food',icon:'utensils',color:'#2878e8'}, {name:'Transport',icon:'bus',color:'#8155d9'},
      {name:'Shopping',icon:'cart',color:'#ffad36'}, {name:'Bills & Utilities',icon:'file',color:'#ef5358'},
      {name:'Entertainment',icon:'star',color:'#ef6bb6'}, {name:'Others',icon:'dots',color:'#8a9aab'}
    ],
    Income: [
      {name:'Salary',icon:'briefcase',color:'#16a36a'}, {name:'Freelance',icon:'user',color:'#ffad36'},
      {name:'Business',icon:'bank',color:'#2878e8'}, {name:'Pocket Money',icon:'gift',color:'#8155d9'},
      {name:'Others',icon:'dots',color:'#8a9aab'}
    ]
  };
  const DEFAULT_BUDGET = {monthly:30000,cats:{'Food':7000,'Transport':4000,'Shopping':5000,'Bills & Utilities':6000,'Entertainment':4000,'Others':4000}};
  const DEFAULT_PROFILE = {name:'',email:'',phone:'',dob:'',joined:'',about:'',photo:''};
  const DEFAULT_SETTINGS = {currency:'INR',dateFormat:'DD MMM YYYY',language:'English',theme:'Light',emailNotifications:true,budgetAlerts:true,alertThreshold:80,rowsPerPage:8,compactTables:false};
  function read(k, fallback) { if (k in mem) return mem[k]; try { const v=localStorage.getItem(PREFIX+k); if(v!==null) return mem[k]=JSON.parse(v); } catch(e){} return fallback; }
  function write(k,v) { mem[k]=v; try{localStorage.setItem(PREFIX+k,JSON.stringify(v));}catch(e){} return true; }
  function remove(k){delete mem[k];try{localStorage.removeItem(PREFIX+k)}catch(e){}}
  async function api(url, method='GET', body) {
    const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));
    if(r.status===401){location.replace('/login');throw new Error('Session expired. Please log in again.');}
    if(!r.ok) throw new Error(d.error||'Could not save data. Please try again.');
    return d;
  }
  const apiStore = {
    useUser(id){PREFIX=BASE+'u'+id+'.';Object.keys(mem).forEach(k=>delete mem[k]);},
    forget(){account=null;PREFIX=BASE;Object.keys(mem).forEach(k=>delete mem[k]);},
    async init(user){
      account=user||account;
      const [tx,cats,budget] = await Promise.all([api('/api/transactions'),api('/api/categories'),api('/api/budget?month='+encodeURIComponent(read('month',new Date().toISOString().slice(0,7))))]);
      write('tx',tx.map(t=>({...t,id:Number(t.id),amount:Number(t.amount)})));
      if(cats.length){const grouped={Income:[],Expense:[]};cats.forEach(c=>{if(grouped[c.type])grouped[c.type].push({id:c.id,name:c.name,type:c.type,icon:c.icon||'dots',color:c.color||'#8a9aab'});});write('cats',grouped);}
      else {write('cats',DEFAULT_CATEGORIES); await api('/api/categories','PUT',{categories:[...DEFAULT_CATEGORIES.Expense.map(c=>({...c,type:'Expense'})),...DEFAULT_CATEGORIES.Income.map(c=>({...c,type:'Income'}))]});}
      write('budget',{monthly:Number(budget.monthly)||0,cats:budget.cats||{}});
      write('settings',{...DEFAULT_SETTINGS,...read('settings',{})});
      write('month',read('month',new Date().toISOString().slice(0,7)));
      const p=await api('/api/profile');
      write('profile',{...DEFAULT_PROFILE,...read('profile',{}),name:p.name||'',email:p.email||'',phone:p.phone||'',about:p.about||'',joined:(p.created_at||'').slice(0,10)});
    },
    transactions:()=>read('tx',[]),
    async addTransaction(t){const d=await api('/api/transactions','POST',t);const list=await api('/api/transactions');write('tx',list.map(x=>({...x,id:Number(x.id),amount:Number(x.amount)})));return d;},
    async updateTransaction(id,patch){const old=apiStore.transactions().find(t=>String(t.id)===String(id));if(!old)throw new Error('Transaction not found.');await api('/api/transactions/'+id,'PUT',{...old,...patch});write('tx',(await api('/api/transactions')).map(x=>({...x,id:Number(x.id),amount:Number(x.amount)})));return true;},
    async deleteTransaction(id){await api('/api/transactions/'+encodeURIComponent(id),'DELETE');write('tx',(await api('/api/transactions')).map(x=>({...x,id:Number(x.id),amount:Number(x.amount)})));return true;},   // reload from MySQL so the UI reflects the database
    async saveTransactions(list){const old=apiStore.transactions();const wanted=new Map(list.map(t=>[String(t.id),t]));for(const t of old){if(!wanted.has(String(t.id)))await api('/api/transactions/'+t.id,'DELETE');}for(const t of list){const prior=old.find(x=>String(x.id)===String(t.id));if(prior){if(JSON.stringify({...prior,id:undefined})!==JSON.stringify({...t,id:undefined}))await api('/api/transactions/'+t.id,'PUT',t);}else await api('/api/transactions','POST',t);}write('tx',(await api('/api/transactions')).map(x=>({...x,id:Number(x.id),amount:Number(x.amount)})));return true;},
    categories:()=>read('cats',DEFAULT_CATEGORIES),
    async saveCategories(c){const flat=[...(c.Expense||[]).map(x=>({...x,type:'Expense'})),...(c.Income||[]).map(x=>({...x,type:'Income'}))];await api('/api/categories','PUT',{categories:flat});const got=await api('/api/categories');const grouped={Income:[],Expense:[]};got.forEach(x=>grouped[x.type].push({...x,icon:x.icon||'dots',color:x.color||'#8a9aab'}));write('cats',grouped);return true;},
    budget:()=>read('budget',DEFAULT_BUDGET),
    async saveBudget(b){const month=apiStore.month();await api('/api/budget?month='+encodeURIComponent(month),'PUT',{month,monthly:Number(b.monthly)||0,cats:b.cats||{}});write('budget',{monthly:Number(b.monthly)||0,cats:b.cats||{}});return true;},
    profile:()=>({...DEFAULT_PROFILE,...read('profile',{})}),
    saveProfile(p){write('profile',{...apiStore.profile(),...p});return true;},
    settings:()=>({...DEFAULT_SETTINGS,...read('settings',{})}),saveSettings:s=>write('settings',s),
    month:()=>read('month',new Date().toISOString().slice(0,7)),
    async saveMonth(m){write('month',m);const b=await api('/api/budget?month='+encodeURIComponent(m));write('budget',{monthly:Number(b.monthly)||0,cats:b.cats||{}});},
    clearAllRecords:async()=>{for(const t of apiStore.transactions())await apiStore.deleteTransaction(t.id);},
    resetSampleData(){return Promise.resolve(false);}
  };
  return apiStore;
})();
