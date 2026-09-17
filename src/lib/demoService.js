import { destinations as seedDestinations, packages as seedPackages, seedReviews, seedCoupons } from '../data/demo.js';
const key=n=>`travelaura_${n}`;
const read=(n,f=[])=>{try{return JSON.parse(localStorage.getItem(key(n))||JSON.stringify(f))}catch{return f}};
const write=(n,v)=>{localStorage.setItem(key(n),JSON.stringify(v));window.dispatchEvent(new Event('travelaura-change'));};
const id=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const cached=()=>{try{return JSON.parse(localStorage.getItem(key('user'))||'null')}catch{return null}};
const cache=u=>{if(u)localStorage.setItem(key('user'),JSON.stringify(u));else localStorage.removeItem(key('user'));if(typeof window!=='undefined')window.dispatchEvent(new Event('travelaura-change'));};
const seed=()=>{const version='5';if(localStorage.getItem(key('schema_version'))!==version){write('destinations',seedDestinations);write('packages',seedPackages);write('reviews',seedReviews);write('coupons',seedCoupons);localStorage.setItem(key('schema_version'),version);}if(!localStorage.getItem(key('users')))write('users',[{id:'demo-admin',name:'Demo Admin',email:'admin@travelaura.com',phone:'9999999999',role:'admin',active:true,createdAt:new Date().toISOString()},{id:'demo-user',name:'Demo User',email:'user@travelaura.com',phone:'8888888888',role:'user',active:true,createdAt:new Date().toISOString()}]);};


const localSave=(n,item)=>{const v={...item,id:item.id||id(n.slice(0,3))};write(n,[v,...read(n).filter(x=>x.id!==v.id)]);return v};
const localUpdate=(n,i,p)=>{const list=read(n).map(x=>x.id===i?{...x,...p}:x);write(n,list);return list.find(x=>x.id===i)};

export const demoAuth={
 getUser:cached,
 login:async(email)=>{const users=read('users');let u=users.find(x=>x.email.toLowerCase()===email.toLowerCase());if(!u){u={id:id('user'),name:email.split('@')[0],email,phone:'',role:email.toLowerCase()==='admin@travelaura.com'?'admin':'user',active:true,createdAt:new Date().toISOString()};write('users',[...users,u]);}if(u.active===false)throw new Error('This account is inactive.');cache(u);return u;},
 register:async(name,email,_password,phone='')=>{if(read('users').some(u=>u.email.toLowerCase()===email.toLowerCase()))throw new Error('An account with this email already exists.');const u={id:id('user'),name,email,phone,role:'user',active:true,createdAt:new Date().toISOString()};write('users',[...read('users'),u]);cache(u);return u;},
 google:async()=>{const u={id:'demo-google',name:'Google Demo User',email:'google.demo@travelaura.com',phone:'',role:'user',active:true,createdAt:new Date().toISOString()};write('users',[...read('users').filter(x=>x.id!==u.id),u]);cache(u);return u;},logout:async()=>cache(null)
};
export const demoDb={
 getDestinations:()=>read('destinations',seedDestinations),getPackages:()=>read('packages',seedPackages),getBookings:()=>read('bookings'),getUsers:()=>read('users'),getReviews:()=>read('reviews',seedReviews),getCoupons:()=>read('coupons',seedCoupons),getContacts:()=>read('contacts'),
 saveDestination:x=>localSave('destinations',x),deleteDestination:i=>{write('destinations',read('destinations').filter(x=>x.id!==i))},savePackage:x=>localSave('packages',x),deletePackage:i=>{write('packages',read('packages').filter(x=>x.id!==i))},
 createBooking:x=>localSave('bookings',{...x,bookingStatus:'pending',paymentStatus:'pending',createdAt:new Date().toISOString()}),updateBooking:(i,p)=>localUpdate('bookings',i,p),
 saveReview:x=>localSave('reviews',{...x,createdAt:x.createdAt||new Date().toISOString()}),updateReview:(i,p)=>localUpdate('reviews',i,p),deleteReview:i=>write('reviews',read('reviews').filter(x=>x.id!==i)),
 saveCoupon:x=>localSave('coupons',x),deleteCoupon:i=>write('coupons',read('coupons').filter(x=>x.id!==i)),updateUser:(i,p)=>localUpdate('users',i,p),saveContact:x=>localSave('contacts',{...x,createdAt:new Date().toISOString()}),
 uploadFile:file=>new Promise((res,rej)=>{if(!file)return res('');const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const scale=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d');if(!context)return rej(new Error('Unable to process this image.'));context.drawImage(image,0,0,canvas.width,canvas.height);res(canvas.toDataURL('image/jpeg',.65));};image.onerror=()=>rej(new Error('Unable to process this image.'));image.src=reader.result;};reader.onerror=()=>rej(new Error('Unable to read this image.'));reader.readAsDataURL(file);})
};
export { seed };
