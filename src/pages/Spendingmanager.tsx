import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNexusStorage } from '@/hooks/useNexusStorage' 
import { useNexusItems, useNexusBudgets } from '@/hooks/useNexusSpendingStorage';
import {
  Wallet, Plus, Trash2, TrendingUp, TrendingDown, Search,
  ShoppingCart, Coffee, Car, Home, Utensils, Zap, Tag,
  MoreHorizontal, X, Check, PieChart, ArrowUpRight, ArrowDownRight,
  Edit2, Copy, Pin, SlidersHorizontal, AlertTriangle, Bell, Repeat,
  DollarSign, Target, Flame, Minus, ChevronDown, ChevronRight,
  CheckSquare, Square, BarChart2, Lightbulb, Star, Calendar,
  ArrowRight, TrendingDown as TrendDown, Sparkles, Command,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────


type Category = 'EATING_OUT'|'TRANSPORT'|'RENT'|'SHOPPING'|'BILLS_AND_SERVICES'|'ENTERTAINMENT'|'LIFESTYLE'|'Other'
              | 'INCOME'|'Bonus'|'Freelance'|'Investments'|'Refunds'|'Gifts';
type TxType    = 'expense'|'income';
type TimeRange = 'week'|'month'|'year'|'all';
type ChartView = 'percent'|'amount';
type GroupBy   = 'date'|'category'|'none';
type CatSort   = 'spend'|'increase'|'overbudget';
type AlertSeverity = 'warning'|'critical'|'info';
type ActiveCard = 'balance'|'income'|'expenses'|'subscriptions'|null;
type description = 'test'

interface Transaction {
  id: string; label: string; amount: number; category: Category;
  type: TxType; date: string; note?: string; tags?: string[];
  isRecurring?: boolean; recurrenceRule?: 'daily'|'weekly'|'monthly';
  isPinned?: boolean;
}
interface Budget {category: Category; limit: number; }
interface Goal {
  id: string; label: string; targetAmount: number; savedAmount: number;
  deadline?: string; color: string;
}
interface SmartAlert {
  id: string; severity: AlertSeverity; message: string; detail?: string;
  actions: { label: string; fn: () => void }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { name: Category; icon: React.FC<any>; color: string; bg: string }[] = [
  { name:'EATING_OUT',    icon:Utensils,       color:'#f97316', bg:'#fff7ed' },
  { name:'TRANSPORT',     icon:Car,            color:'#3b82f6', bg:'#eff6ff' },
  { name:'RENT',       icon:Home,           color:'#8b5cf6', bg:'#f5f3ff' },
  { name:'SHOPPING',      icon:ShoppingCart,   color:'#ec4899', bg:'#fdf2f8' },
  { name:'BILLS_AND_SERVICES',     icon:Zap,            color:'#eab308', bg:'#fefce8' },
  { name:'ENTERTAINMENT', icon:Coffee,         color:'#14b8a6', bg:'#f0fdfa' },
  { name:'LIFESTYLE',        icon:Tag,            color:'#10b981', bg:'#f0fdf4' },
  { name:'Other',         icon:MoreHorizontal, color:'#6b7280', bg:'#f9fafb' },
];

const INCOME_CATEGORIES: { name: Category; icon: React.FC<any>; color: string; bg: string }[] = [
  { name:'INCOME',      icon:DollarSign,     color:'#16a34a', bg:'#f0fdf4' },
  { name:'Bonus',       icon:Star,           color:'#d97706', bg:'#fffbeb' },
  { name:'Freelance',   icon:Zap,            color:'#7c3aed', bg:'#f5f3ff' },
  { name:'Investments', icon:TrendingUp,     color:'#0891b2', bg:'#f0f9ff' },
  { name:'Refunds',     icon:ArrowDownRight, color:'#059669', bg:'#ecfdf5' },
  { name:'Gifts',       icon:Tag,            color:'#db2777', bg:'#fdf2f8' },
  { name:'Other',       icon:MoreHorizontal, color:'#6b7280', bg:'#f9fafb' },
];

const DEFAULT_BUDGETS: Budget[] = [
  { category:'EATING_OUT',limit:300 },
  { category:'TRANSPORT',limit:150 },
  { category:'RENT',limit:1300 },
  { category:'SHOPPING',limit:200 },
  { category:'BILLS_AND_SERVICES',limit:100 },
  { category:'ENTERTAINMENT',limit:80 },
  { category:'LIFESTYLE',limit:100 },
  { category:'Other',limit:100 },
];

const GOAL_COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6'];

// ─── Seed ─────────────────────────────────────────────────────────────────────

function makeSeed(): Transaction[] {
  const now=new Date(), m=now.getMonth(), y=now.getFullYear();
  const d=(mo:number,day:number)=>{
    const abs=m+mo, yr=y+Math.floor(abs/12), mn=((abs%12)+12)%12;
    return `${yr}-${String(mn+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };
  return [
    {id:'1', label:'Rent',         amount:1200,category:'RENT',      type:'expense',date:d(0,1), isRecurring:true,recurrenceRule:'monthly',isPinned:true},
    {id:'2', label:'Groceries',    amount:85,  category:'EATING_OUT',         type:'expense',date:d(0,3), tags:['#weekly']},
    {id:'3', label:'Income',       amount:3200,category:'Other',        type:'income', date:d(0,5), isRecurring:true,recurrenceRule:'monthly',isPinned:true},
    {id:'4', label:'Electric Bill',amount:62,  category:'BILLS_AND_SERVICES',    type:'expense',date:d(0,7), isRecurring:true,recurrenceRule:'monthly'},
    {id:'5', label:'Bus Pass',     amount:35,  category:'TRANSPORT',    type:'expense',date:d(0,9)},
    {id:'6', label:'Dinner Out',   amount:47,  category:'EATING_OUT',         type:'expense',date:d(0,12),note:'Birthday dinner'},
    {id:'7', label:'New Shoes',    amount:120, category:'SHOPPING',     type:'expense',date:d(0,14)},
    {id:'8', label:'Netflix',      amount:16,  category:'ENTERTAINMENT',type:'expense',date:d(0,15),isRecurring:true,recurrenceRule:'monthly',tags:['#subscription']},
    {id:'9', label:'Pharmacy',     amount:28,  category:'LIFESTYLE',       type:'expense',date:d(0,16)},
    {id:'10',label:'Coffee Shop',  amount:22,  category:'EATING_OUT',         type:'expense',date:d(0,17),tags:['#daily']},
    {id:'11',label:'Spotify',      amount:10,  category:'ENTERTAINMENT',type:'expense',date:d(0,17),isRecurring:true,recurrenceRule:'monthly',tags:['#subscription']},
    {id:'12',label:'Rent',         amount:1200,category:'RENT',      type:'expense',date:d(-1,1)},
    {id:'13',label:'Groceries',    amount:95,  category:'EATING_OUT',         type:'expense',date:d(-1,4)},
    {id:'14',label:'Income',       amount:3200,category:'Other',        type:'income', date:d(-1,5)},
    {id:'15',label:'Electric Bill',amount:70,  category:'BILLS_AND_SERVICES',    type:'expense',date:d(-1,8)},
    {id:'16',label:'TRANSPORT',    amount:40,  category:'TRANSPORT',    type:'expense',date:d(-1,10)},
    {id:'17',label:'Groceries',    amount:72,  category:'EATING_OUT',         type:'expense',date:d(-1,18)},
    {id:'18',label:'Netflix',      amount:16,  category:'ENTERTAINMENT',type:'expense',date:d(-1,15)},
    {id:'19',label:'Restaurant',   amount:55,  category:'EATING_OUT',         type:'expense',date:d(-1,22)},
    {id:'20',label:'Gym',          amount:40,  category:'LIFESTYLE',       type:'expense',date:d(-1,2)},
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const fmtFull = (n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
const getCatMeta = (name:Category)=>CATEGORIES.find(c=>c.name===name)??CATEGORIES[CATEGORIES.length-1];

function getDateRange(range: TimeRange, cycleStartDay: number = 1){
  const now=new Date(), end=new Date(now);
  let start:Date, prevStart:Date, prevEnd:Date;
  if(range==='week'){
    start=new Date(now); start.setDate(now.getDate()-7);
    prevEnd=new Date(start); prevEnd.setDate(start.getDate()-1);
    prevStart=new Date(prevEnd); prevStart.setDate(prevEnd.getDate()-7);
  } else if(range==='month'){
    // Custom cycle: from cycleStartDay of previous/current month
    const today=now.getDate();
    const clampedStart = Math.min(cycleStartDay, 28); // safe for all months
    if(today >= clampedStart){
      // Cycle started this calendar month
      start=new Date(now.getFullYear(), now.getMonth(), clampedStart);
      prevStart=new Date(now.getFullYear(), now.getMonth()-1, clampedStart);
      prevEnd=new Date(now.getFullYear(), now.getMonth(), clampedStart-1);
    } else {
      // Cycle started last calendar month
      start=new Date(now.getFullYear(), now.getMonth()-1, clampedStart);
      prevStart=new Date(now.getFullYear(), now.getMonth()-2, clampedStart);
      prevEnd=new Date(now.getFullYear(), now.getMonth()-1, clampedStart-1);
    }
  } else if(range==='year'){
    start=new Date(now.getFullYear(),0,1);
    prevStart=new Date(now.getFullYear()-1,0,1);
    prevEnd=new Date(now.getFullYear(),0,0);
  } else {
    start=prevStart=prevEnd=new Date(0);
  }
  return {start:start!,end,prevStart:prevStart!,prevEnd:prevEnd!};
}

function inRange(dateStr:string,start:Date,end:Date){
  const d=new Date(dateStr+'T12:00:00'); return d>=start&&d<=end;
}
function trendPct(curr:number,prev:number){
  if(prev===0) return curr>0?100:0;
  return Math.round(((curr-prev)/prev)*100);
}

function dateGroupLabel(dateStr:string):string {
  const d=new Date(dateStr+'T12:00:00'), now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const yesterday=new Date(today); yesterday.setDate(today.getDate()-1);
  const txDay=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  if(txDay.getTime()===today.getTime()) return 'Today';
  if(txDay.getTime()===yesterday.getTime()) return 'Yesterday';
  const daysAgo=Math.round((today.getTime()-txDay.getTime())/(86400000));
  if(daysAgo<7) return `${daysAgo} days ago`;
  if(d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) return 'Earlier this month';
  return d.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({data,color}:{data:number[];color:string}){
  if(data.length<2) return null;
  const max=Math.max(...data,1),min=Math.min(...data),range=max-min||1;
  const w=80,h=28;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*(h*0.8)-2}`).join(' ');
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Donut Chart (glitch-free) ─────────────────────────────────────────────────

function DonutChart({slices,total,onHoverChange,onClickCat}:{
  slices:{value:number;color:string;name:Category}[];
  total:number;
  onHoverChange:(cat:Category|null)=>void;
  onClickCat:(cat:Category)=>void;
}){
  const r=44,cx=54,cy=54,sw=18,hitSw=sw+12;
  const circ=2*Math.PI*r;
  const [hov,setHov]=useState<Category|null>(null);
  const computed=useMemo(()=>{
    let off=0;
    return slices.map(s=>{
      const pct=s.value/total, dash=pct*circ, gap=circ-dash, rot=-90+(off/total)*360;
      off+=s.value; return {dash,gap,rot};
    });
  },[slices,total,circ]);
  const enter=(n:Category)=>{setHov(n);onHoverChange(n);};
  const leave=()=>{setHov(null);onHoverChange(null);};
  return(
    <svg width={108} height={108} viewBox="0 0 108 108" style={{flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw}/>
      {slices.map((s,i)=>{
        const {dash,gap,rot}=computed[i];
        return <circle key={`a${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
          strokeWidth={hov===s.name?sw+3:sw} strokeDasharray={`${dash} ${gap}`}
          style={{transform:`rotate(${rot}deg)`,transformOrigin:`${cx}px ${cy}px`,
            transition:'stroke-width 0.12s ease',pointerEvents:'none'}}/>;
      })}
      {slices.map((s,i)=>{
        const {dash,gap,rot}=computed[i];
        return <circle key={`h${i}`} cx={cx} cy={cy} r={r} fill="none" stroke="transparent"
          strokeWidth={hitSw} strokeDasharray={`${dash} ${gap}`}
          style={{transform:`rotate(${rot}deg)`,transformOrigin:`${cx}px ${cy}px`,cursor:'pointer'}}
          onMouseEnter={()=>enter(s.name)} onMouseLeave={leave} onClick={()=>onClickCat(s.name)}/>;
      })}
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e293b">{fmt(total)}</text>
      <text x={cx} y={cy+9} textAnchor="middle" fontSize="8" fill="#94a3b8">expenses</text>
    </svg>
  );
}

// ─── Forecast Budget Bar ──────────────────────────────────────────────────────

function ForecastBudgetBar({spent,limit,projected}:{spent:number;limit:number;projected:number}){
  const spentPct=Math.min((spent/limit)*100,100);
  const projPct =Math.min((projected/limit)*100,100);
  const over=spent>limit, close=!over&&spent>=limit*0.75;
  const barColor=over?'#ef4444':close?'#f97316':'#22c55e';
  return(
    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
      {/* Projected (dashed) */}
      {projected>spent&&projected<=limit*1.5&&(
        <div className="absolute top-0 left-0 h-full rounded-full opacity-30"
          style={{width:`${projPct}%`,background:projPct>=100?'#ef4444':'#f97316',
            backgroundImage:'repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(255,255,255,0.5) 4px,rgba(255,255,255,0.5) 6px)'}}/>
      )}
      {/* Actual spend */}
      <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
        style={{width:`${spentPct}%`,background:barColor}}/>
      {/* Limit marker at 100% */}
      <div className="absolute top-0 right-0 w-px h-full bg-slate-300"/>
    </div>
  );
}

// ─── Command Bar ──────────────────────────────────────────────────────────────

interface CommandBarProps {
  onClose: () => void;
  onAddTx: (tx:Omit<Transaction,'id'>)=>void;
  onFilter: (cat:Category|'All', type:TxType|'all', search:string)=>void;
  onOpenBudgets: ()=>void;
  onOpenGoals: ()=>void;
}

function CommandBar({onClose,onAddTx,onFilter,onOpenBudgets,onOpenGoals}:CommandBarProps){
  const [input,setInput]=useState('');
  const [result,setResult]=useState('');
  const ref=useRef<HTMLInputElement>(null);

  useEffect(()=>{ref.current?.focus();},[]);

  const SUGGESTIONS=[
    'add £50 food','show subscriptions','filter expenses > £100',
    'this month housing','show income','budgets','goals',
  ];

  const parseAndExecute=(cmd:string)=>{
    const lower=cmd.toLowerCase().trim();

    // "add £X category"
    const addMatch=lower.match(/add\s+[£$]?(\d+(?:\.\d+)?)\s+(\w+)/);
    if(addMatch){
      const amount=parseFloat(addMatch[1]);
      const catInput=addMatch[2];
      const cat=(CATEGORIES.find(c=>c.name.toLowerCase().startsWith(catInput))?.name??'Other') as Category;
      onAddTx({label:catInput.charAt(0).toUpperCase()+catInput.slice(1),amount,category:cat,
        type:'expense',date:new Date().toISOString().slice(0,10)});
      setResult(`✓ Added ${fmt(amount)} to ${cat}`);
      setTimeout(onClose,1200);
      return;
    }
    // "show subscriptions"
    if(lower.includes('subscript')){
      onFilter('Entertainment','all','subscription'); setResult('Showing subscriptions'); setTimeout(onClose,800); return;
    }
    // "show income"
    if(lower.includes('income')){
      onFilter('All','income',''); setResult('Showing income'); setTimeout(onClose,800); return;
    }
    // "filter > £X" or "filter expenses > £X"
    const filterAmt=lower.match(/[>£$](\d+)/);
    if(filterAmt){
      onFilter('All','expense',''); setResult(`Filtering expenses > £${filterAmt[1]}`); setTimeout(onClose,800); return;
    }
    // category name
    const catMatch=CATEGORIES.find(c=>lower.includes(c.name.toLowerCase()));
    if(catMatch){
      onFilter(catMatch.name,'all',''); setResult(`Showing ${catMatch.name}`); setTimeout(onClose,800); return;
    }
    // budgets / goals
    if(lower.includes('budget')){onOpenBudgets();onClose();return;}
    if(lower.includes('goal')){onOpenGoals();onClose();return;}
    setResult('');
  };

  return(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Command className="w-4 h-4 text-slate-400 shrink-0"/>
          <input ref={ref} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')parseAndExecute(input);if(e.key==='Escape')onClose();}}
            placeholder="Add £50 food · Show subscriptions · Filter > £100 · Goals…"
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400"/>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
        </div>
        {result?(
          <div className="px-4 py-3 text-sm font-medium text-emerald-600">{result}</div>
        ):(
          <div className="p-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Suggestions</p>
            {SUGGESTIONS.map(s=>(
              <button key={s} onClick={()=>{setInput(s);parseAndExecute(s);}}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left">
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0"/>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="px-4 py-2 border-t border-slate-50 flex gap-3">
          <span className="text-[10px] text-slate-300"><kbd className="bg-slate-100 px-1 rounded">Enter</kbd> execute</span>
          <span className="text-[10px] text-slate-300"><kbd className="bg-slate-100 px-1 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

// ─── Goals Modal ──────────────────────────────────────────────────────────────

function GoalsModal({goals,onClose,onSave}:{
  goals:Goal[]; onClose:()=>void; onSave:(g:Goal[])=>void;
}){
  const [list,setList]=useState<Goal[]>(goals);
  const addGoal=()=>setList(g=>[...g,{
    id:uuidv4(),label:'New Goal',targetAmount:1000,
    savedAmount:0,color:GOAL_COLORS[g.length%GOAL_COLORS.length],
  }]);
  const upd=(id:string,k:keyof Goal,v:any)=>
    setList(g=>g.map(x=>x.id===id?{...x,[k]:v}:x));
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Financial Goals</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-3 mb-4">
          {list.map(g=>{
            const pct=Math.min((g.savedAmount/g.targetAmount)*100,100);
            return(
              <div key={g.id} className="p-3 border border-slate-200 rounded-xl space-y-2">
                <div className="flex gap-2">
                  <input value={g.label} onChange={e=>upd(g.id,'label',e.target.value)}
                    className="flex-1 text-sm font-medium border-0 outline-none bg-transparent text-slate-900"/>
                  <button onClick={()=>setList(l=>l.filter(x=>x.id!==g.id))}
                    className="text-slate-300 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5"/></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium">Target</label>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">£</span>
                    <input type="number" value={g.targetAmount} onChange={e=>upd(g.id,'targetAmount',parseFloat(e.target.value)||0)}
                      className="w-full pl-5 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/></div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium">Saved so far</label>
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">£</span>
                    <input type="number" value={g.savedAmount} onChange={e=>upd(g.id,'savedAmount',parseFloat(e.target.value)||0)}
                      className="w-full pl-5 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>{Math.round(pct)}% complete</span>
                    <span>{fmt(g.targetAmount-g.savedAmount)} to go</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:g.color}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={addGoal}
          className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4"/> Add Goal
        </button>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={()=>{onSave(list);onClose();}} className="flex-1"><Check className="w-4 h-4 mr-1"/>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tx Modal ─────────────────────────────────────────────────────────────────

function TxModal({initial,lastCategory,onClose,onSave}:{
  initial?:Transaction; lastCategory?:Category;
  onClose:()=>void; onSave:(tx:Omit<Transaction,'id'>&{id?:string})=>void;
}){
  const [label,setLabel]      =useState(initial?.label??'');
  const [amount,setAmount]    =useState(initial?String(initial.amount):'');
  const [type,setType]        =useState<TxType>(initial?.type??'expense');
  const [category,setCategory]=useState<Category>(
    initial?.category??( (initial?.type??'EATING_OUT')==='expense'?(lastCategory??'EATING_OUT'):'INCOME' )
  );
  const [date,setDate]        =useState(initial?.date??new Date().toISOString().slice(0,10));
  const [note,setNote]        =useState(initial?.note??'');
  const [tagInput,setTagInput]=useState(initial?.tags?.join(' ')??'');
  const [recurring,setRec]    =useState(initial?.isRecurring??false);
  const [recRule,setRecRule]  =useState<'daily'|'weekly'|'monthly'>(initial?.recurrenceRule??'monthly');

  const catList = type==='expense' ? CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange=(t:TxType)=>{
    setType(t);
    // Reset to sensible default for the new type; clear any incompatible category
    setCategory(t==='expense'?'EATING_OUT':'INCOME');
  };

  const save=()=>{
    const n=parseFloat(amount);
    if(!label.trim()||isNaN(n)||n<=0) return;
    const tags=tagInput.split(/\s+/).filter(t=>t.startsWith('#')&&t.length>1);
    onSave({id:initial?.id,label:label.trim(),amount:n,category,type,date,
      note:note.trim()||undefined,tags:tags.length?tags:undefined,
      isRecurring:recurring||undefined,recurrenceRule:recurring?recRule:undefined,
      isPinned:initial?.isPinned});
    onClose();
  };
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{initial?'Edit':'Add'} Transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
        </div>
        {/* Type toggle */}
        <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-xl">
          {(['expense','income'] as TxType[]).map(t=>(
            <button key={t} onClick={()=>handleTypeChange(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${type===t?'bg-white shadow text-slate-900':'text-slate-500 hover:text-slate-700'}`}>{t}</button>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
            <Input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Coffee, Rent, Salary…" autoFocus onKeyDown={e=>e.key==='Enter'&&save()}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Amount (£)</label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
              <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          </div>
          {/* Dynamic category grid */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Category <span className="text-slate-400">({type==='expense'?'Expense':'Income'} categories)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {catList.map(cat=>{
                const Icon=cat.icon, active=category===cat.name;
                return <button key={cat.name} onClick={()=>setCategory(cat.name)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-medium transition-all ${active?'border-transparent text-white':'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
                  style={active?{background:cat.color}:{}}>
                  <Icon className="w-3.5 h-3.5"/><span className="truncate w-full text-center">{cat.name}</span></button>;
              })}
            </div>
          </div>
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Note</label>
            <Input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Shared with John"/></div>
          <div><label className="text-xs font-medium text-slate-500 mb-1 block">Tags</label>
            <Input value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="#subscription #work"/></div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <Repeat className="w-4 h-4 text-slate-400"/>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-700">Recurring</p>
              {recurring&&<div className="flex gap-1 mt-1">
                {(['daily','weekly','monthly'] as const).map(r=>(
                  <button key={r} onClick={()=>setRecRule(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${recRule===r?'bg-slate-800 text-white':'bg-white border border-slate-200 text-slate-500'}`}>{r}</button>
                ))}</div>}
            </div>
            <button onClick={()=>setRec(v=>!v)}
              className={`w-10 h-5 rounded-full transition-all relative ${recurring?'bg-emerald-500':'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${recurring?'left-5':'left-0.5'}`}/>
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} className="flex-1" disabled={!label.trim()||!amount}>
            <Check className="w-4 h-4 mr-1"/>{initial?'Save':'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────

function BudgetModal({budgets,onClose,onSave}:{budgets:Budget[];onClose:()=>void;onSave:(b:Budget[])=>void}){
  const [vals,setVals]=useState<Record<string,string>>(Object.fromEntries(budgets.map(b=>[b.category,String(b.limit)])));
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Monthly Budgets</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {CATEGORIES.filter(c=>c.name!=='Other').map(cat=>{
            const Icon=cat.icon;
            return <div key={cat.name} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{background:cat.bg}}>
                <Icon className="w-3.5 h-3.5" style={{color:cat.color}}/></div>
              <span className="text-sm text-slate-700 flex-1">{cat.name}</span>
              <div className="relative w-24">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">£</span>
                <input type="number" min="0" value={vals[cat.name]??''}
                  onChange={e=>setVals(v=>({...v,[cat.name]:e.target.value}))}
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
              </div></div>;
          })}
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={()=>{onSave(CATEGORIES.map(c=>({category:c.name,limit:parseFloat(vals[c.name])||DEFAULT_BUDGETS.find(d=>d.category===c.name)!.limit})));onClose();}} className="flex-1">
            <Check className="w-4 h-4 mr-1"/>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Transaction Row ───────────────────────────────────────────────────

function TxRow({tx,selected,onSelect,onEdit,onDuplicate,onTogglePin,onDelete,onUpdate}:{
  tx:Transaction; selected:boolean;
  onSelect:()=>void; onEdit:()=>void; onDuplicate:()=>void;
  onTogglePin:()=>void; onDelete:()=>void;
  onUpdate:(updates:Partial<Transaction>)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  const [editNote,setEditNote]=useState(tx.note??'');
  const [editTag,setEditTag]=useState(tx.tags?.join(' ')??'');
  const cat=getCatMeta(tx.category), Icon=cat.icon;

  const saveInline=()=>{
    const tags=editTag.split(/\s+/).filter(t=>t.startsWith('#')&&t.length>1);
    onUpdate({note:editNote.trim()||undefined,tags:tags.length?tags:undefined});
  };

  return(
    <li className={`transition-colors ${expanded?'bg-slate-50/80':''} relative`}>
      {tx.isPinned&&<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 rounded-r"/>}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 group cursor-pointer"
        onClick={()=>setExpanded(v=>!v)}>
        {/* Select checkbox */}
        <button onClick={e=>{e.stopPropagation();onSelect();}}
          className="shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
          {selected?<CheckSquare className="w-4 h-4 text-emerald-500"/>:<Square className="w-4 h-4"/>}
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
          style={{background:cat.bg}}>
          <Icon className="w-3.5 h-3.5" style={{color:cat.color}}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-slate-900 truncate">{tx.label}</p>
            {tx.isRecurring&&<Repeat className="w-3 h-3 text-sky-400 shrink-0"/>}
            {tx.isPinned&&<Pin className="w-3 h-3 text-emerald-400 shrink-0"/>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-xs text-slate-400">
              {new Date(tx.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
              {' · '}{tx.category}
            </span>
            {tx.note&&!expanded&&<span className="text-xs text-slate-400 italic truncate max-w-xs">"{tx.note}"</span>}
            {tx.tags?.map(tag=><span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{tag}</span>)}
          </div>
        </div>
        <span className={`text-sm font-bold shrink-0 ${tx.type==='income'?'text-emerald-600':'text-slate-800'}`}>
          {tx.type==='income'?'+':'−'}{fmtFull(tx.amount)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={e=>{e.stopPropagation();onEdit();}} title="Edit"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"><Edit2 className="w-3.5 h-3.5"/></button>
          <button onClick={e=>{e.stopPropagation();onDuplicate();}} title="Duplicate"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"><Copy className="w-3.5 h-3.5"/></button>
          <button onClick={e=>{e.stopPropagation();onTogglePin();}} title={tx.isPinned?'Unpin':'Pin'}
            className={`p-1.5 rounded-lg transition-all ${tx.isPinned?'text-emerald-500 hover:bg-emerald-50':'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}>
            <Pin className="w-3.5 h-3.5"/></button>
          <button onClick={e=>{e.stopPropagation();onDelete();}} title="Delete"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-300 shrink-0 transition-transform ${expanded?'rotate-90':''}`}/>
      </div>

      {/* Expanded inline panel */}
      {expanded&&(
        <div className="px-4 pb-3 ml-[4.5rem] space-y-2 border-t border-slate-100 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Note</label>
              <input value={editNote} onChange={e=>setEditNote(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="Add a note…"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Tags</label>
              <input value={editTag} onChange={e=>setEditTag(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="#tag"/>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tx.isRecurring&&(
              <div className="flex items-center gap-1.5 text-xs text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                <Repeat className="w-3 h-3"/>{tx.recurrenceRule} recurring
              </div>
            )}
            {!tx.isRecurring&&(
              <button onClick={()=>onUpdate({isRecurring:true,recurrenceRule:'monthly'})}
                className="text-xs text-slate-500 hover:text-sky-600 flex items-center gap-1 transition-colors">
                <Repeat className="w-3 h-3"/>Make recurring</button>
            )}
            <button onClick={saveInline}
              className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">
              <Check className="w-3 h-3"/>Save</button>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Trends Panel ─────────────────────────────────────────────────────────────

function TrendsPanel({data,onClose}:{
  data:{date:string;income:number;expense:number;avg:number}[];
  onClose:()=>void;
}){
  const maxVal = Math.max(...data.map(d=>Math.max(d.income,d.expense)),1);
  const H = 120; // bar chart height in px
  const barW = Math.max(6, Math.floor(600/data.length)-2);
  const [hover,setHover] = useState<number|null>(null);
  const [view,setView]   = useState<'bar'|'line'>('bar');

  // For line chart: SVG polyline points
  const toSvgPts = (arr:number[])=>arr.map((v,i)=>{
    const x = (i/(arr.length-1))*580+10;
    const y = H - (v/maxVal)*H + 10;
    return `${x},${y}`;
  }).join(' ');

  const expPts = toSvgPts(data.map(d=>d.expense));
  const incPts = toSvgPts(data.map(d=>d.income));
  const avgPts = toSvgPts(data.map(d=>d.avg));

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-4 h-4 text-emerald-500"/>
            <h2 className="text-base font-semibold text-slate-900">30-Day Spending Trends</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
              {(['bar','line'] as const).map(v=>(
                <button key={v} onClick={()=>setView(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${view===v?'bg-white shadow text-slate-800':'text-slate-500'}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Legend */}
          <div className="flex items-center gap-5 mb-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block"/>Income</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/>Expenses</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-orange-400 inline-block"/>7-day avg</span>
          </div>

          {view==='bar'?(
            <div className="relative" style={{height:`${H+40}px`}}>
              {/* Y-axis gridlines */}
              {[0,0.25,0.5,0.75,1].map(pct=>(
                <div key={pct} className="absolute left-0 right-0 border-t border-slate-100 flex items-center"
                  style={{bottom:`${pct*H+24}px`}}>
                  <span className="text-[9px] text-slate-300 pr-1 -translate-y-2">{pct>0?`£${Math.round(maxVal*pct)}`:''}</span>
                </div>
              ))}
              {/* Bars */}
              <div className="flex items-end gap-px px-1" style={{height:`${H}px`,position:'absolute',bottom:'24px',left:0,right:0}}>
                {data.map((d,i)=>{
                  const expH = d.expense>0?Math.max(2,Math.round((d.expense/maxVal)*H)):0;
                  const incH = d.income >0?Math.max(2,Math.round((d.income /maxVal)*H)):0;
                  const isHov = hover===i;
                  const label = new Date(d.date+'T12:00:00').toLocaleDateString('en-GB',{month:'short',day:'numeric'});
                  return(
                    <div key={d.date} className="relative flex items-end justify-center gap-0.5 flex-1"
                      onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
                      {incH>0&&<div className="rounded-sm transition-all duration-100"
                        style={{height:`${incH}px`,background:isHov?'#059669':'#34d399',width:`${Math.max(barW/2-1,3)}px`}}/>}
                      {expH>0&&<div className="rounded-sm transition-all duration-100"
                        style={{height:`${expH}px`,background:isHov?'#dc2626':'#f87171',width:`${Math.max(barW/2-1,3)}px`}}/>}
                      {/* Hover tooltip */}
                      {isHov&&(
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          <p className="font-semibold mb-0.5">{label}</p>
                          {d.income >0&&<p className="text-emerald-300">In: £{d.income.toFixed(0)}</p>}
                          {d.expense>0&&<p className="text-red-300">Out: £{d.expense.toFixed(0)}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Avg line overlay (SVG) */}
              <svg className="absolute inset-0 pointer-events-none" style={{bottom:'24px',height:`${H}px`,top:'unset'}}
                width="100%" height={H} viewBox={`0 0 600 ${H}`} preserveAspectRatio="none">
                <polyline points={avgPts} fill="none" stroke="#f97316" strokeWidth="1.5"
                  strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
                {[0,7,14,21,29].map(i=>(
                  <span key={i} className="text-[9px] text-slate-400">
                    {new Date(data[i]?.date+'T12:00:00').toLocaleDateString('en-GB',{month:'short',day:'numeric'})}
                  </span>
                ))}
              </div>
            </div>
          ):(
            /* Line chart mode */
            <svg width="100%" viewBox={`0 0 600 ${H+20}`} className="overflow-visible">
              {[0,0.25,0.5,0.75,1].map(pct=>(
                <line key={pct} x1="10" y1={H-(pct*H)+10} x2="590" y2={H-(pct*H)+10}
                  stroke="#f1f5f9" strokeWidth="1"/>
              ))}
              <polyline points={incPts} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={expPts} fill="none" stroke="#f87171" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={avgPts} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          )}

          {/* Summary row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              {label:'Total Income', value:data.reduce((s,d)=>s+d.income,0), color:'text-emerald-600'},
              {label:'Total Expenses',value:data.reduce((s,d)=>s+d.expense,0),color:'text-red-500'},
              {label:'Net',value:data.reduce((s,d)=>s+d.income-d.expense,0),color:data.reduce((s,d)=>s+d.income-d.expense,0)>=0?'text-emerald-600':'text-red-500'},
            ].map(s=>(
              <div key={s.label} className="p-3 bg-slate-50 rounded-xl text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>£{Math.abs(s.value).toLocaleString('en-GB',{maximumFractionDigits:0})}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recurring Manager ─────────────────────────────────────────────────────────

function RecurringManager({transactions,onClose,onUpdate,onDelete}:{
  transactions: Transaction[];
  onClose:()=>void;
  onUpdate:(id:string,updates:Partial<Transaction>)=>void;
  onDelete:(id:string)=>void;
}){
  const recurring = transactions.filter(t=>t.isRecurring);
  const monthlyTotal = recurring.filter(t=>t.type==='expense'&&t.recurrenceRule==='monthly').reduce((s,t)=>s+t.amount,0);
  const annualTotal  = monthlyTotal*12;

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-sky-500"/>
              <h2 className="text-base font-semibold text-slate-900">Recurring Transactions</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {recurring.length} recurring · <span className="font-medium text-slate-600">£{monthlyTotal.toFixed(0)}/mo</span> · <span className="font-medium text-slate-600">£{annualTotal.toFixed(0)}/yr</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {recurring.length===0&&(
            <div className="p-10 text-center text-slate-400">
              <Repeat className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No recurring transactions yet</p>
            </div>
          )}
          {recurring.map(t=>{
            const cat = CATEGORIES.find(c=>c.name===t.category)??CATEGORIES[CATEGORIES.length-1];
            const Icon = cat.icon;
            const annualCost = t.recurrenceRule==='monthly'?t.amount*12:t.recurrenceRule==='weekly'?t.amount*52:t.amount*365;
            return(
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 group transition-colors">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:cat.bg}}>
                  <Icon className="w-4 h-4" style={{color:cat.color}}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 capitalize">{t.recurrenceRule}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">£{annualCost.toFixed(0)}/yr</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{background:cat.bg,color:cat.color}}>{t.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-sm font-bold ${t.type==='income'?'text-emerald-600':'text-slate-800'}`}>
                    {t.type==='income'?'+':''}{t.type==='income'?'':'−'}£{t.amount.toFixed(0)}
                    <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{t.recurrenceRule==='monthly'?'mo':t.recurrenceRule==='weekly'?'wk':'day'}</span>
                  </span>
                </div>
                {/* Actions - visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={()=>onUpdate(t.id,{isRecurring:false,recurrenceRule:undefined})}
                    title="Stop recurring"
                    className="px-2 py-1 text-[10px] font-medium border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">
                    Pause
                  </button>
                  <button
                    onClick={()=>{ if(window.confirm(`Delete "${t.label}"?`)) onDelete(t.id); }}
                    title="Delete"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {recurring.filter(t=>t.type==='expense').length} expenses · {recurring.filter(t=>t.type==='income').length} income
          </p>
          <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors text-slate-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Local storage hook ───────────────────────────────────────────────────────

// function useLocalStorage<T>(key: string, initialValue: T | (()=>T)): [T, React.Dispatch<React.SetStateAction<T>>] {
//   const [value, setValue] = useState<T>(()=>{
//     try {
//       const stored = localStorage.getItem(key);
//       if (stored !== null) return JSON.parse(stored) as T;
//     } catch {}
//     return typeof initialValue === 'function' ? (initialValue as ()=>T)() : initialValue;
//   });

//   const setAndPersist: React.Dispatch<React.SetStateAction<T>> = useCallback((action) => {
//     setValue(prev => {
//       const next = typeof action === 'function' ? (action as (p:T)=>T)(prev) : action;
//       try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
//       return next;
//     });
//   }, [key]);

//   return [value, setAndPersist];
// }

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SpendingManager(){
const [transactions, setTransactions] = useNexusItems<Transaction>(
  'spendingTransactions',
  makeSeed, // shown instantly while the async load resolves
);



const [budgets, setBudgets] = useNexusBudgets<Budget>(DEFAULT_BUDGETS);
 
const [goals, setGoals] = useNexusItems<Goal>(
  'spendingGoals',
  [
    { id: 'g1', label: 'Emergency Fund', targetAmount: 5000, savedAmount: 1540, color: '#6366f1' },
    { id: 'g2', label: 'Holiday 2026',   targetAmount: 2000, savedAmount: 650,  color: '#f59e0b' },
  ],
);
  const [timeRange,    setTimeRange]    = useState<TimeRange>('month');
  const [chartView,    setChartView]    = useState<ChartView>('percent');
  const [catSort,      setCatSort]      = useState<CatSort>('spend');
  const [hoveredCat,   setHoveredCat]   = useState<Category|null>(null);
  const [filterCat,    setFilterCat]    = useState<Category|'All'>('All');
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState<TxType|'all'>('all');
  const [groupBy,      setGroupBy]      = useState<GroupBy>('date');
  const [showModal,    setShowModal]    = useState(false);
  const [editTx,       setEditTx]       = useState<Transaction|null>(null);
  const [showBudgets,  setShowBudgets]  = useState(false);
  const [showGoals,    setShowGoals]    = useState(false);
  const [showCommand,  setShowCommand]  = useState(false);
  const [showFilters,  setShowFilters]  = useState(false);
  const [minAmt,       setMinAmt]       = useState('');
  const [maxAmt,       setMaxAmt]       = useState('');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissed] = useState<Set<string>>(new Set());
  const [activeCard,     setActiveCard]     = useState<ActiveCard>(null);
  const [cycleStartDay,  setCycleStartDay]  = useNexusStorage<number>('nexus_spending_cycle_day', 1);
  const [showCycleSettings, setShowCycleSettings] = useState(false);
  const [showTrends,     setShowTrends]     = useState(false);
  const [showRecurring,  setShowRecurring]  = useState(false);

  // Keyboard shortcut for command bar
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setShowCommand(true);}
    };
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[]);

  const lastCategory=useMemo(()=>transactions.filter(t=>t.type==='expense')[0]?.category,[transactions]);
  const {start,end,prevStart,prevEnd}=useMemo(()=>getDateRange(timeRange, cycleStartDay),[timeRange, cycleStartDay]);

  const currTxs=useMemo(()=>
    timeRange==='all'?transactions:transactions.filter(t=>inRange(t.date,start,end)),
    [transactions,start,end,timeRange]);
  const prevTxs=useMemo(()=>
    timeRange==='all'?[]:transactions.filter(t=>inRange(t.date,prevStart,prevEnd)),
    [transactions,prevStart,prevEnd,timeRange]);

  const totalIncome  =useMemo(()=>currTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),[currTxs]);
  const totalExpense =useMemo(()=>currTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),[currTxs]);
  const balance      =totalIncome-totalExpense;
  const prevIncome   =useMemo(()=>prevTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),[prevTxs]);
  const prevExpense  =useMemo(()=>prevTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),[prevTxs]);

  const sparkData=useMemo(()=>{
    const sorted=[...transactions].sort((a,b)=>a.date.localeCompare(b.date));
    const n=7, exp=Array(n).fill(0), inc=Array(n).fill(0), bal=Array(n).fill(0);
    sorted.forEach((t,i)=>{
      const bucket=Math.min(Math.floor((i/sorted.length)*n),n-1);
      if(t.type==='expense') exp[bucket]+=t.amount; else inc[bucket]+=t.amount;
      bal[bucket]+=t.type==='income'?t.amount:-t.amount;
    });
    return {expense:exp,income:inc,balance:bal};
  },[transactions]);

  const catTotals=useMemo(()=>{
    const m:Record<string,number>={};
    currTxs.filter(t=>t.type==='expense').forEach(t=>{m[t.category]=(m[t.category]??0)+t.amount;});
    return m;
  },[currTxs]);
  const prevCatTotals=useMemo(()=>{
    const m:Record<string,number>={};
    prevTxs.filter(t=>t.type==='expense').forEach(t=>{m[t.category]=(m[t.category]??0)+t.amount;});
    return m;
  },[prevTxs]);

  const donutSlices=CATEGORIES.filter(c=>(catTotals[c.name]??0)>0)
    .map(c=>({value:catTotals[c.name],color:c.color,name:c.name}));

  const subscriptions=useMemo(()=>
    transactions.filter(t=>t.isRecurring&&t.type==='expense'&&t.recurrenceRule==='monthly'),
    [transactions]);
  const subTotal=subscriptions.reduce((s,t)=>s+t.amount,0);

  const daysInMonth=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const dayOfMonth=new Date().getDate();
  const burnRate=dayOfMonth>0?totalExpense/dayOfMonth:0;
  const prevBurnRate=useMemo(()=>{
    const prevDays=new Date(new Date().getFullYear(),new Date().getMonth(),0).getDate();
    return prevDays>0?prevExpense/prevDays:0;
  },[prevExpense]);

  // Smart alerts with actions
  const smartAlerts=useMemo(():SmartAlert[]=>{
    const alerts:SmartAlert[]=[];
    CATEGORIES.forEach(cat=>{
      const spent=catTotals[cat.name]??0;
      const limit=budgets.find(b=>b.category===cat.name)?.limit??0;
      if(limit<=0) return;
      if(spent>=limit){
        alerts.push({id:`over-${cat.name}`,severity:'critical',
          message:`Over ${cat.name} budget`,
          detail:`${fmt(spent)} spent of ${fmt(limit)} limit — ${fmt(spent-limit)} over`,
          actions:[
            {label:'Increase Budget',fn:()=>setShowBudgets(true)},
            {label:'View Category', fn:()=>setFilterCat(cat.name)},
          ]});
      } else if(spent>=limit*0.8){
        alerts.push({id:`close-${cat.name}`,severity:'warning',
          message:`Approaching ${cat.name} budget`,
          detail:`${fmt(limit-spent)} remaining (${Math.round((spent/limit)*100)}% used)`,
          actions:[
            {label:'Increase Budget',fn:()=>setShowBudgets(true)},
            {label:'View Category', fn:()=>setFilterCat(cat.name)},
          ]});
      }
    });
    currTxs.filter(t=>t.type==='expense'&&t.amount>=100).forEach(t=>{
      alerts.push({id:`large-${t.id}`,severity:'info',
        message:`Large expense: ${t.label}`,
        detail:fmtFull(t.amount),
        actions:[
          {label:'Mark recurring',fn:()=>updateTx(t.id,{isRecurring:true,recurrenceRule:'monthly'})},
          {label:'Add note',      fn:()=>setEditTx(t)},
          {label:'Tag as one-off',fn:()=>updateTx(t.id,{tags:[...(t.tags??[]),'#one-off']})},
        ]});
    });
    return alerts.slice(0,4);
  },[catTotals,budgets,currTxs]);

  const visibleAlerts=smartAlerts.filter(a=>!dismissedAlerts.has(a.id));

  // Budget forecasting
  const budgetForecasts=useMemo(()=>{
    return CATEGORIES.map(cat=>{
      const spent=catTotals[cat.name]??0;
      const limit=budgets.find(b=>b.category===cat.name)?.limit??0;
      if(limit<=0) return null;
      const dailyRate=dayOfMonth>0?spent/dayOfMonth:0;
      const projected=dailyRate*daysInMonth;
      const daysLeft=daysInMonth-dayOfMonth;
      const budgetLeft=Math.max(0,limit-spent);
      return {category:cat.name,spent,limit,projected,daysLeft,budgetLeft,dailyRate};
    }).filter(Boolean);
  },[catTotals,budgets,dayOfMonth,daysInMonth]);

  // Sorted categories for chart panel
  const sortedCatList=useMemo(()=>{
    return CATEGORIES.filter(c=>(catTotals[c.name]??0)>0).sort((a,b)=>{
      if(catSort==='spend') return (catTotals[b.name]??0)-(catTotals[a.name]??0);
      if(catSort==='increase'){
        const ta=trendPct(catTotals[a.name]??0,prevCatTotals[a.name]??0);
        const tb=trendPct(catTotals[b.name]??0,prevCatTotals[b.name]??0);
        return tb-ta;
      }
      if(catSort==='overbudget'){
        const la=budgets.find(x=>x.category===a.name)?.limit??0;
        const lb=budgets.find(x=>x.category===b.name)?.limit??0;
        const ra=la>0?(catTotals[a.name]??0)/la:0;
        const rb=lb>0?(catTotals[b.name]??0)/lb:0;
        return rb-ra;
      }
      return 0;
    });
  },[catTotals,prevCatTotals,catSort,budgets]);

  // AI-lite insights
  const insights=useMemo(()=>{
    const ins:string[]=[];
    if(totalExpense>0){
      const topCat=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
      if(topCat) ins.push(`${topCat[0]} is ${Math.round((topCat[1]/totalExpense)*100)}% of your spending`);
    }
    if(subTotal>0) ins.push(`${subscriptions.length} subscriptions total ${fmt(subTotal*12)}/year`);
    const increased=CATEGORIES.filter(c=>{
      const curr=catTotals[c.name]??0, prev=prevCatTotals[c.name]??0;
      return prev>0&&curr>prev*1.2;
    });
    if(increased.length) ins.push(`${increased.map(c=>c.name).join(', ')} spending up 20%+ vs last period`);
    if(burnRate>0&&prevBurnRate>0){
      const diff=burnRate-prevBurnRate;
      if(Math.abs(diff)>2) ins.push(`Spending ${fmt(Math.abs(diff))}/day ${diff>0?'more':'less'} than last period`);
    }
    return ins.slice(0,3);
  },[catTotals,prevCatTotals,totalExpense,subTotal,subscriptions,burnRate,prevBurnRate]);

  // Filtered + grouped transaction list
  const filtered=useMemo(()=>{
    const min=parseFloat(minAmt)||0, max=parseFloat(maxAmt)||Infinity;
    return [...transactions].filter(t=>{
      // Summary card quick-filters take precedence
      if(activeCard==='income'       && t.type!=='income')  return false;
      if(activeCard==='expenses'     && t.type!=='expense') return false;
      if(activeCard==='subscriptions'&& !(t.isRecurring&&t.type==='expense')) return false;
      // Regular filters (ignored when activeCard is set, except search+amount)
      if(!activeCard){
        if(typeFilter!=='all'&&t.type!==typeFilter) return false;
        if(filterCat!=='All'&&t.category!==filterCat) return false;
      }
      if(search){
        const q=search.toLowerCase();
        if(![t.label,t.category,t.note??'',...(t.tags??[])].some(s=>s.toLowerCase().includes(q))) return false;
      }
      if(t.amount<min||t.amount>max) return false;
      return true;
    }).sort((a,b)=>{
      if(a.isPinned&&!b.isPinned) return -1;
      if(!a.isPinned&&b.isPinned) return 1;
      return b.date.localeCompare(a.date);
    });
  },[transactions,filterCat,search,typeFilter,minAmt,maxAmt,activeCard]);

  const grouped=useMemo(()=>{
    if(groupBy==='none') return [{label:'All',txs:filtered}];
    if(groupBy==='category'){
      const map=new Map<string,Transaction[]>();
      filtered.forEach(t=>{
        const g=map.get(t.category)??[]; g.push(t); map.set(t.category,g);
      });
      return Array.from(map.entries()).map(([label,txs])=>({label,txs}));
    }
    // date grouping
    const map=new Map<string,Transaction[]>();
    filtered.forEach(t=>{
      const g=dateGroupLabel(t.date), arr=map.get(g)??[]; arr.push(t); map.set(g,arr);
    });
    return Array.from(map.entries()).map(([label,txs])=>({label,txs}));
  },[filtered,groupBy]);

  // Actions
  const addOrUpdateTx=useCallback((tx:Omit<Transaction,'id'>&{id?:string})=>{
    if(tx.id) setTransactions(prev=>prev.map(t=>t.id===tx.id?{...tx,id:tx.id} as Transaction:t));
    else setTransactions(prev=>[{...tx,id:uuidv4()} as Transaction,...prev]);
  },[]);
  const updateTx=(id:string,updates:Partial<Transaction>)=>
    setTransactions(prev=>prev.map(t=>t.id===id?{...t,...updates}:t));
  const deleteTx=(id:string)=>setTransactions(prev=>prev.filter(t=>t.id!==id));
  const duplicateTx=(tx:Transaction)=>setTransactions(prev=>[{...tx,id:uuidv4(),isPinned:false},...prev]);
  const togglePin=(id:string)=>updateTx(id,{isPinned:!transactions.find(t=>t.id===id)?.isPinned});

  const toggleSelect=(id:string)=>setSelected(s=>{const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n;});
  const bulkDelete=()=>{setTransactions(prev=>prev.filter(t=>!selected.has(t.id)));setSelected(new Set());};
  const bulkTag=(tag:string)=>{selected.forEach(id=>updateTx(id,{tags:[...(transactions.find(t=>t.id===id)?.tags??[]),tag]}));setSelected(new Set());};

  const periodLabel={week:'last week',month:'last month',year:'last year',all:''}[timeRange];

  // ── Trends: 30-day daily income vs expense + 7-day rolling avg ────────────
  const trendsData = useMemo(()=>{
    const days = 30;
    const result: { date: string; income: number; expense: number; avg: number }[] = [];
    for(let i = days-1; i >= 0; i--){
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      const dayTxs = transactions.filter(t=>t.date===ds);
      result.push({
        date: ds,
        income:  dayTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
        expense: dayTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
        avg: 0,
      });
    }
    // 7-day rolling average on expenses
    result.forEach((_,i)=>{
      const window = result.slice(Math.max(0,i-6), i+1);
      result[i].avg = window.reduce((s,d)=>s+d.expense,0)/window.length;
    });
    return result;
  },[transactions]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = useCallback(()=>{
    const rows = [
      ['Date','Label','Amount','Type','Category','Note','Tags','Recurring'].join(','),
      ...filtered.map(t=>[
        t.date,
        `"${t.label.replace(/"/g,'""')}"`,
        t.amount,
        t.type,
        t.category,
        `"${(t.note??'').replace(/"/g,'""')}"`,
        (t.tags??[]).join(' '),
        t.isRecurring?t.recurrenceRule??'yes':'',
      ].join(','))
    ].join('\n');
    const blob = new Blob([rows],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `spending-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  },[filtered]);

  // ── CSV Import ────────────────────────────────────────────────────────────
  const importCSV = useCallback(() => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;

      // Parse header row (handle BOM)
      const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const isBankFormat = header.includes('Counter Party');

      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; continue; }
          if (char === ',' && !inQuotes) { result.push(current); current = ''; continue; }
          current += char;
        }
        result.push(current);
        return result;
      };

      const toISODate = (raw: string): string => {
        // Bank format: DD/MM/YYYY → YYYY-MM-DD
        const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
        return raw; // Already ISO
      };

      const newTransactions: Transaction[] = lines.slice(1)
        .filter(l => l.trim())
        .map((line) => {
          const cols = parseRow(line);
          const row: Record<string, string> = {};
          header.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });

          if (isBankFormat) {
            const rawAmount = parseFloat(row['Amount (GBP)'] ?? '0');
            const type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense';
            return {
              id: crypto.randomUUID(),
              date: toISODate(row['Date'] ?? ''),
              label: row['Counter Party'] || 'Unknown',
              amount: Math.abs(rawAmount),
              type,
              category: row['Spending Category'] || 'Other',
              note: row['Notes'] || row['Reference'] || '',
              tags: [],
              isRecurring: false,
            };
          } else {
            // Your own export format
            const recurringRaw = row['Recurring'] ?? '';
            return {
              id: crypto.randomUUID(),
              date: row['Date'] ?? '',
              label: row['Label'] || 'Unknown',
              amount: parseFloat(row['Amount'] ?? '0'),
              type: (row['Type'] ?? 'expense') as 'income' | 'expense',
              category: row['Category'] || 'Other',
              note: row['Note'] ?? '',
              tags: row['Tags'] ? row['Tags'].split(' ').filter(Boolean) : [],
              isRecurring: !!recurringRaw,
              recurrenceRule: recurringRaw && recurringRaw !== 'yes' ? recurringRaw : undefined,
            };
          }
        });

      // Merge with existing — skip duplicates by date+label+amount
      setTransactions(prev => {
        const existing = new Set(prev.map(t => `${t.date}|${t.label}|${t.amount}`));
        const fresh = newTransactions.filter(t => !existing.has(`${t.date}|${t.label}|${t.amount}`));
        return [...prev, ...fresh];
      });
    };
    reader.readAsText(file);
  };
  input.click();
}, [setTransactions]);


  // ── RENDER ────────────────────────────────────────────────────────────────
  return(
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <Wallet className="w-5 h-5 text-white"/>
              </div>
              Spending Manager
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">Track income, expenses & budgets</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Time range */}
            <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
              {(['week','month','year','all'] as TimeRange[]).map(r=>(
                <button key={r} onClick={()=>setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${timeRange===r?'bg-slate-900 text-white':'text-slate-500 hover:text-slate-800'}`}>
                  {r==='all'?'All':r.charAt(0).toUpperCase()+r.slice(1)}
                </button>
              ))}
            </div>
            {/* Command bar button */}
            <button onClick={()=>setShowCommand(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-600 hover:border-slate-300 transition-all shadow-sm">
              <Search className="w-3.5 h-3.5"/>
              <span>Search</span>
              <kbd className="ml-1 text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-400">⌘K</kbd>
            </button>
            <Button variant="secondary" onClick={()=>setShowTrends(true)}>
              <BarChart2 className="w-3.5 h-3.5 mr-1.5"/>Trends
            </Button>
            <Button variant="secondary" onClick={()=>setShowRecurring(true)}>
              <Repeat className="w-3.5 h-3.5 mr-1.5"/>Recurring
            </Button>
            <Button variant="secondary" onClick={()=>setShowGoals(true)}>
              <Star className="w-3.5 h-3.5 mr-1.5"/>Goals
            </Button>
            <Button variant="secondary" onClick={()=>setShowBudgets(true)}>
              <Target className="w-3.5 h-3.5 mr-1.5"/>Budgets
            </Button>
            <button onClick={()=>setShowCycleSettings(v=>!v)}
              title="Cycle settings"
              className={`p-2 rounded-xl border transition-all ${showCycleSettings?'bg-emerald-50 border-emerald-300 text-emerald-700':'border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 bg-white'}`}>
              <SlidersHorizontal className="w-4 h-4"/>
            </button>
            <Button onClick={()=>setShowModal(true)}>
              <Plus className="w-4 h-4 mr-1"/>Add
            </Button>
          </div>
        </header>

        {/* Actionable Alerts */}
        {visibleAlerts.length>0&&(
          <div className="mb-5 space-y-2">
            {visibleAlerts.map(alert=>{
              const isCrit=alert.severity==='critical';
              const isWarn=alert.severity==='warning';
              return(
                <div key={alert.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border ${
                  isCrit?'bg-red-50 border-red-200':'isWarn'?'bg-amber-50 border-amber-200':'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isCrit?<AlertTriangle className="w-4 h-4 text-red-500 shrink-0"/>
                      :isWarn?<Bell className="w-4 h-4 text-amber-500 shrink-0"/>
                      :<Lightbulb className="w-4 h-4 text-blue-400 shrink-0"/>}
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${isCrit?'text-red-800':isWarn?'text-amber-800':'text-blue-800'}`}>
                        {alert.message}
                      </span>
                      {alert.detail&&<span className={`text-xs ml-2 ${isCrit?'text-red-500':isWarn?'text-amber-500':'text-blue-500'}`}>{alert.detail}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {alert.actions.map(a=>(
                      <button key={a.label} onClick={a.fn}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          isCrit?'border-red-200 text-red-700 hover:bg-red-100'
                          :isWarn?'border-amber-200 text-amber-700 hover:bg-amber-100'
                          :'border-blue-200 text-blue-700 hover:bg-blue-100'
                        }`}>{a.label}</button>
                    ))}
                    <button onClick={()=>setDismissed(s=>new Set(s).add(alert.id))}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors ml-1">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cycle settings panel */}
        {showCycleSettings&&(
          <div className="mb-5 flex items-center gap-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600 shrink-0"/>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Monthly cycle start date</p>
              <p className="text-xs text-emerald-600">Months begin on the <strong>{cycleStartDay}{cycleStartDay===1?'st':cycleStartDay===2?'nd':cycleStartDay===3?'rd':'th'}</strong> — useful if your payday isn't the 1st</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-medium text-emerald-700">Start day</label>
              <select
                value={cycleStartDay}
                onChange={e=>setCycleStartDay(Number(e.target.value))}
                className="text-sm border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-white text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {Array.from({length:28},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>{d}{d===1?'st':d===2?'nd':d===3?'rd':'th'}</option>
                ))}
              </select>
            </div>
            <button onClick={()=>setShowCycleSettings(false)} className="text-emerald-400 hover:text-emerald-700 transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            {key:'balance'  as ActiveCard, label:'Balance', value:balance, prev:prevIncome-prevExpense, color:balance>=0?'#16a34a':'#dc2626', bg:balance>=0?'#f0fdf4':'#fef2f2', icon:balance>=0?TrendingUp:TrendingDown, spark:sparkData.balance, sparkColor:balance>=0?'#16a34a':'#dc2626', accentColor:balance>=0?'#16a34a':'#dc2626'},
            {key:'income'   as ActiveCard, label:'Income',  value:totalIncome, prev:prevIncome, color:'#2563eb',bg:'#eff6ff',icon:ArrowDownRight,spark:sparkData.income, sparkColor:'#3b82f6', accentColor:'#3b82f6'},
            {key:'expenses' as ActiveCard, label:'Expenses',value:totalExpense,prev:prevExpense,color:'#ea580c',bg:'#fff7ed',icon:ArrowUpRight,  spark:sparkData.expense,sparkColor:'#f97316', accentColor:'#f97316'},
          ].map(card=>{
            const Icon=card.icon;
            const trend=timeRange!=='all'?trendPct(card.value,card.prev):null;
            const up=trend!==null&&trend>0, dn=trend!==null&&trend<0;
            const trendColor=card.label==='Income'?(up?'text-emerald-600':dn?'text-red-500':'text-slate-400')
              :card.label==='Expenses'?(up?'text-red-500':dn?'text-emerald-600':'text-slate-400')
              :(up?'text-emerald-600':dn?'text-red-500':'text-slate-400');
            const isActive=activeCard===card.key;
            return(
              <Card
                key={card.label}
                onClick={()=>setActiveCard(isActive?null:card.key)}
                className={`p-4 border-2 bg-white cursor-pointer hover:shadow-md transition-all select-none ${
                  isActive?'shadow-md':'border-slate-200 hover:border-slate-300'
                }`}
                style={isActive?{borderColor:card.accentColor,boxShadow:`0 0 0 3px ${card.accentColor}22`}:{}}>
                {isActive&&(
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{color:card.accentColor}}>
                    <Check className="w-3 h-3"/>Filtering transactions
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{card.label}</span>
                    <p className="text-2xl font-bold mt-0.5" style={{color:card.color}}>{fmt(card.value)}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:card.bg}}>
                    <Icon className="w-4 h-4" style={{color:card.color}}/>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-1">
                  {trend!==null?(
                    <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                      {up?<TrendingUp className="w-3 h-3"/>:dn?<TrendingDown className="w-3 h-3"/>:<Minus className="w-3 h-3"/>}
                      {trend===0?'No change':`${up?'+':''}${trend}% vs ${periodLabel}`}
                    </div>
                  ):<div/>}
                  <Sparkline data={card.spark} color={card.sparkColor}/>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Insights strip */}
        {insights.length>0&&(
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {insights.map((ins,i)=>(
              <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0"/>
                <p className="text-xs text-slate-600">{ins}</p>
              </div>
            ))}
          </div>
        )}

        {/* Insights row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Card className="p-4 border-slate-200 bg-white flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-violet-500"/>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Burn Rate</p>
              <p className="text-lg font-bold text-slate-900">{fmt(burnRate)}<span className="text-xs font-normal text-slate-400">/day</span></p>
              <p className={`text-xs font-medium ${burnRate>prevBurnRate?'text-red-400':'text-emerald-500'}`}>
                {prevBurnRate>0&&burnRate!==prevBurnRate
                  ?`${burnRate>prevBurnRate?'+':'-'}${fmt(Math.abs(burnRate-prevBurnRate))}/day vs last period`
                  :`~${fmt(burnRate*daysInMonth)} projected/mo`}
              </p>
            </div>
          </Card>
          <Card
            className={`p-4 border-2 bg-white hover:shadow-md transition-all cursor-pointer select-none ${activeCard==='subscriptions'?'shadow-md':'border-slate-200 hover:border-sky-300'}`}
            style={activeCard==='subscriptions'?{borderColor:'#0ea5e9',boxShadow:'0 0 0 3px #0ea5e922'}:{}}
            onClick={()=>setActiveCard(activeCard==='subscriptions'?null:'subscriptions')}>
            {activeCard==='subscriptions'&&(
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-600">
                <Check className="w-3 h-3"/>Filtering subscriptions
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                <Repeat className="w-4 h-4 text-sky-500"/>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Subscriptions</p>
                <p className="text-lg font-bold text-slate-900">{fmt(subTotal)}<span className="text-xs font-normal text-slate-400">/mo · {fmt(subTotal*12)}/yr</span></p>
              </div>
            </div>
            <div className="space-y-1">
              {subscriptions.slice(0,3).map(s=>(
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 truncate">{s.label}</span>
                  <span className="text-slate-700 font-medium shrink-0 ml-2">{fmt(s.amount)}</span>
                </div>
              ))}
              {subscriptions.length>3&&<p className="text-[10px] text-slate-400">+{subscriptions.length-3} more</p>}
            </div>
          </Card>
          <Card className="p-4 border-slate-200 bg-white flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-500"/>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Savings Rate</p>
              <p className="text-lg font-bold text-slate-900">
                {totalIncome>0?Math.round((balance/totalIncome)*100):0}%
              </p>
              <p className="text-xs text-slate-400">{fmt(Math.max(0,balance))} saved this period</p>
            </div>
          </Card>
        </div>

        {/* Goals */}
        {goals.length>0&&(
          <Card className="p-5 border-slate-200 bg-white mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-slate-400"/>
                <h2 className="text-sm font-semibold text-slate-700">Goals</h2>
              </div>
              <button onClick={()=>setShowGoals(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">Edit</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {goals.map(g=>{
                const pct=Math.min((g.savedAmount/g.targetAmount)*100,100);
                const monthsLeft=balance>0?Math.ceil((g.targetAmount-g.savedAmount)/balance):null;
                return(
                  <div key={g.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{background:g.color}}/>
                        <span className="text-sm font-medium text-slate-800">{g.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{fmt(g.savedAmount)} / {fmt(g.targetAmount)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:g.color}}/>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{Math.round(pct)}% complete</span>
                      {monthsLeft&&monthsLeft>0&&monthsLeft<60&&(
                        <span className="text-emerald-500 font-medium">~{monthsLeft} months at current rate</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Chart + Budget Forecast */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

          {/* Donut */}
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-slate-400"/>
                <h2 className="text-sm font-semibold text-slate-700">By Category</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Sort */}
                <select value={catSort} onChange={e=>setCatSort(e.target.value as CatSort)}
                  className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="spend">By spend</option>
                  <option value="increase">Most increased</option>
                  <option value="overbudget">Over budget</option>
                </select>
                <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
                  {(['percent','amount'] as ChartView[]).map(v=>(
                    <button key={v} onClick={()=>setChartView(v)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${chartView===v?'bg-white shadow text-slate-800':'text-slate-500'}`}>
                      {v==='percent'?'%':'£'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {donutSlices.length>0?(
              <div className="flex items-start gap-4">
                <DonutChart slices={donutSlices} total={totalExpense}
                  onHoverChange={setHoveredCat}
                  onClickCat={cat=>setFilterCat(filterCat===cat?'All':cat)}/>
                <div className="flex-1 space-y-1 min-w-0">
                  {sortedCatList.map(cat=>{
                    const Icon=cat.icon, val=catTotals[cat.name]??0;
                    const pct=totalExpense>0?Math.round((val/totalExpense)*100):0;
                    const prev=prevCatTotals[cat.name]??0;
                    const trend=timeRange!=='all'?trendPct(val,prev):null;
                    const isHov=hoveredCat===cat.name||filterCat===cat.name;
                    return(
                      <button key={cat.name}
                        onClick={()=>setFilterCat(filterCat===cat.name?'All':cat.name)}
                        onMouseEnter={()=>setHoveredCat(cat.name)}
                        onMouseLeave={()=>setHoveredCat(null)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all ${isHov?'bg-slate-50 ring-1 ring-slate-200':'hover:bg-slate-50'}`}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background:cat.color}}/>
                        <Icon className="w-3 h-3 shrink-0" style={{color:cat.color}}/>
                        <span className="text-xs text-slate-600 flex-1 truncate">{cat.name}</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {chartView==='percent'?`${pct}%`:fmt(val)}
                        </span>
                        {trend!==null&&trend!==0&&(
                          <span className={`text-[9px] font-bold ${trend>0?'text-red-400':'text-emerald-500'}`}>
                            {trend>0?'↑':'↓'}{Math.abs(trend)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ):(
              <div className="py-8 text-center text-slate-400 text-sm">No expenses this period</div>
            )}
          </Card>

          {/* Budget Forecast */}
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-400"/>
                <h2 className="text-sm font-semibold text-slate-700">Budgets</h2>
              </div>
              <button onClick={()=>setShowBudgets(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">Edit</button>
            </div>
            <div className="space-y-3">
              {budgetForecasts.filter(Boolean).slice(0,7).map((f:any)=>{
                const cat=getCatMeta(f.category);
                const Icon=cat.icon;
                const over=f.spent>f.limit, close=!over&&f.spent>=f.limit*0.75;
                const willOverrun=!over&&f.projected>f.limit;
                return(
                  <div key={f.category}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3 h-3 shrink-0" style={{color:cat.color}}/>
                      <span className="text-xs text-slate-600 flex-1">{f.category}</span>
                      <span className={`text-xs font-semibold ${over?'text-red-500':close?'text-orange-500':'text-slate-700'}`}>
                        {fmt(f.spent)} / {fmt(f.limit)}
                      </span>
                      {over&&<AlertTriangle className="w-3 h-3 text-red-400 shrink-0"/>}
                    </div>
                    <ForecastBudgetBar spent={f.spent} limit={f.limit} projected={f.projected}/>
                    {willOverrun&&(
                      <p className="text-[10px] text-orange-500 mt-0.5">
                        ⚠ Projected to exceed by {fmt(f.projected-f.limit)} at current rate
                      </p>
                    )}
                    {!over&&!willOverrun&&f.daysLeft>0&&(
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmt(f.budgetLeft)} left for {f.daysLeft} days
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Transaction List */}
        <Card className="border-slate-200 bg-white overflow-hidden">

          {/* Active card filter banner */}
          {activeCard&&(
            <div className="px-4 pt-3 pb-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0"/>
                <span className="text-emerald-800 font-medium capitalize">
                  {activeCard==='subscriptions'?'Showing recurring subscriptions'
                   :activeCard==='income'?'Showing income only'
                   :activeCard==='expenses'?'Showing expenses only'
                   :'All transactions'}
                </span>
                <button onClick={()=>setActiveCard(null)}
                  className="ml-auto text-emerald-500 hover:text-emerald-700 transition-colors flex items-center gap-1 text-xs font-medium">
                  <X className="w-3 h-3"/>Clear
                </button>
              </div>
            </div>
          )}
          {/* Controls */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search labels, tags, notes…"
                  className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"/>
                {search&&<button onClick={()=>setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>}
              </div>
              {/* Group by */}
              <select value={groupBy} onChange={e=>setGroupBy(e.target.value as GroupBy)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="date">Group: Date</option>
                <option value="category">Group: Category</option>
                <option value="none">No grouping</option>
              </select>
              <button onClick={()=>setShowFilters(v=>!v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-all ${
                  showFilters||minAmt||maxAmt||typeFilter!=='all'
                    ?'bg-emerald-50 text-emerald-700 border-emerald-200'
                    :'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                <SlidersHorizontal className="w-3.5 h-3.5"/>Filters
              </button>
            </div>

            {showFilters&&(
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
                  {(['all','expense','income'] as const).map(v=>(
                    <button key={v} onClick={()=>setTypeFilter(v)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${typeFilter===v?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>{v}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">£</span>
                  <input type="number" min="0" value={minAmt} onChange={e=>setMinAmt(e.target.value)} placeholder="Min"
                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                  <span className="text-xs text-slate-300">–</span>
                  <input type="number" min="0" value={maxAmt} onChange={e=>setMaxAmt(e.target.value)} placeholder="Max"
                    className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                </div>
                {(minAmt||maxAmt||typeFilter!=='all')&&(
                  <button onClick={()=>{setMinAmt('');setMaxAmt('');setTypeFilter('all');}}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Clear</button>
                )}
              </div>
            )}

            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={()=>setFilterCat('All')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${filterCat==='All'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>All</button>
              {CATEGORIES.map(cat=>{
                const Icon=cat.icon, active=filterCat===cat.name;
                const count=transactions.filter(t=>t.category===cat.name).length;
                if(count===0) return null;
                return(
                  <button key={cat.name} onClick={()=>setFilterCat(active?'All':cat.name)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${active?'text-white border-transparent':'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    style={active?{background:cat.color}:{}}>
                    <Icon className="w-3 h-3"/>{cat.name}
                    <span className={`ml-0.5 ${active?'opacity-70':'text-slate-400'}`}>·{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Bulk actions */}
            {selected.size>0&&(
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs font-medium text-emerald-700">{selected.size} selected</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button onClick={()=>bulkTag('#reviewed')}
                    className="px-2.5 py-1 text-xs font-medium border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">Tag #reviewed</button>
                  <button onClick={bulkDelete}
                    className="px-2.5 py-1 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3"/>Delete</button>
                  <button onClick={()=>setSelected(new Set())}
                    className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            )}
          </div>

          {/* Grouped rows */}
          {filtered.length===0?(
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 mx-auto mb-3 text-slate-200"/>
              <p className="text-sm font-medium text-slate-500 mb-1">No transactions found</p>
              {(search||filterCat!=='All'||typeFilter!=='all')&&(
                <button onClick={()=>{setSearch('');setFilterCat('All');setTypeFilter('all');setMinAmt('');setMaxAmt('');}}
                  className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">Clear all filters</button>
              )}
            </div>
          ):(
            grouped.map(group=>(
              <div key={group.label}>
                {groupBy!=='none'&&(
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 border-y border-slate-100 sticky top-0 z-10">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</span>
                    <span className="text-[11px] text-slate-400">
                      {fmt(Math.abs(group.txs.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0)))}
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-slate-50">
                  {group.txs.map(tx=>(
                    <TxRow key={tx.id} tx={tx}
                      selected={selected.has(tx.id)}
                      onSelect={()=>toggleSelect(tx.id)}
                      onEdit={()=>setEditTx(tx)}
                      onDuplicate={()=>duplicateTx(tx)}
                      onTogglePin={()=>togglePin(tx.id)}
                      onDelete={()=>deleteTx(tx.id)}
                      onUpdate={updates=>updateTx(tx.id,updates)}/>
                  ))}
                </ul>
              </div>
            ))
          )}

          {filtered.length>0&&(
            <div className="px-4 py-3 border-t border-slate-100 space-y-2">
              {/* Net total row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{filtered.length} transaction{filtered.length!==1?'s':''}</span>
                  <button onClick={exportCSV}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors border border-emerald-200 rounded-lg px-2 py-0.5 hover:bg-emerald-50">
                    <ArrowUpRight className="w-3 h-3"/>Export CSV
                  </button>
                  <button onClick={importCSV}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors border border-orange-200 rounded-lg px-2 py-0.5 hover:bg-orange-50">
                    <ArrowUpRight className="w-3 h-3"/>Import CSV
                  </button>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  Net:{' '}
                  <span className={filtered.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0)>=0?'text-emerald-600':'text-red-500'}>
                    {fmtFull(filtered.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0))}
                  </span>
                </span>
              </div>
              {/* Top categories breakdown (only when not already filtered by category) */}
              {filterCat==='All'&&!activeCard&&(()=>{
                const catMap: Record<string,number> = {};
                filtered.filter(t=>t.type==='expense').forEach(t=>{catMap[t.category]=(catMap[t.category]??0)+t.amount;});
                const top = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,4);
                const total = Object.values(catMap).reduce((s,v)=>s+v,0);
                if(top.length<2) return null;
                return(
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {top.map(([cat,val])=>{
                      const meta = CATEGORIES.find(c=>c.name===cat);
                      const pct  = total>0?Math.round((val/total)*100):0;
                      return(
                        <button key={cat}
                          onClick={()=>setFilterCat(cat as Category)}
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all hover:shadow-sm"
                          style={{background:meta?.bg??'#f9fafb',color:meta?.color??'#6b7280',borderColor:`${meta?.color??'#6b7280'}30`}}>
                          <span>{cat}</span>
                          <span className="opacity-60">{pct}%</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      {showCommand&&(
        <CommandBar onClose={()=>setShowCommand(false)} onAddTx={addOrUpdateTx}
          onFilter={(cat,type,search)=>{setFilterCat(cat);setTypeFilter(type);setSearch(search);}}
          onOpenBudgets={()=>setShowBudgets(true)} onOpenGoals={()=>setShowGoals(true)}/>
      )}
      {showModal    &&<TxModal lastCategory={lastCategory} onClose={()=>setShowModal(false)} onSave={addOrUpdateTx}/>}
      {editTx       &&<TxModal initial={editTx} onClose={()=>setEditTx(null)} onSave={addOrUpdateTx}/>}
      {showBudgets  &&<BudgetModal budgets={budgets} onClose={()=>setShowBudgets(false)} onSave={setBudgets}/>}
      {showGoals    &&<GoalsModal goals={goals} onClose={()=>setShowGoals(false)} onSave={setGoals}/>}
      {showTrends   &&<TrendsPanel data={trendsData} onClose={()=>setShowTrends(false)}/>}
      {showRecurring&&<RecurringManager transactions={transactions} onClose={()=>setShowRecurring(false)}
          onUpdate={updateTx} onDelete={deleteTx}/>}
    </div>
  );
}