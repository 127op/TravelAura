export const destinations = [
  {id:'manali',name:'Manali',country:'India',state:'Himachal Pradesh',category:'Mountains',bestTime:'October - June',duration:'4-6 days',budget:18000,image:'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',description:'Snowy peaks, pine forests and lively mountain cafés in the Beas valley.',attractions:['Solang Valley','Hadimba Temple','Old Manali','Atal Tunnel'],thingsToDo:['Paragliding','River rafting','Local café hopping'],food:['Siddu','Trout','Himachali dham'],travelTips:['Carry layers even in summer','Pre-book Rohtang permits','Keep one buffer day for mountain weather']},
  {id:'goa',name:'Goa',country:'India',state:'Goa',category:'Beaches',bestTime:'November - February',duration:'4-5 days',budget:22000,image:'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',description:'Golden beaches, Portuguese heritage, nightlife and laid-back coastal charm.',attractions:['Baga Beach','Old Goa','Fontainhas','Dudhsagar Falls'],thingsToDo:['Water sports','Sunset cruise','Heritage walk'],food:['Fish curry rice','Bebinca','Prawn balchão'],travelTips:['Rent a scooter with valid license','Use sunscreen','Explore South Goa for quieter beaches']},
  {id:'jaipur',name:'Jaipur',country:'India',state:'Rajasthan',category:'Historical',bestTime:'October - March',duration:'3-4 days',budget:15000,image:'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',description:'A royal city of forts, palaces, bazaars and iconic pink architecture.',attractions:['Amber Fort','Hawa Mahal','City Palace','Jantar Mantar'],thingsToDo:['Fort tour','Block-print workshop','Bazaar shopping'],food:['Dal baati churma','Pyaaz kachori','Ghevar'],travelTips:['Start forts early','Carry cash for local markets','Dress comfortably for walking']},
  {id:'kashmir',name:'Kashmir',country:'India',state:'Jammu & Kashmir',category:'Mountains',bestTime:'March - October',duration:'5-7 days',budget:32000,image:'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80',description:'Alpine valleys, houseboats, meadows and dramatic Himalayan scenery.',attractions:['Dal Lake','Gulmarg','Pahalgam','Sonamarg'],thingsToDo:['Shikara ride','Gondola ride','Meadow walks'],food:['Rogan josh','Kahwa','Yakhni'],travelTips:['Check local travel advisories','Carry warm layers','Keep ID documents handy']},
  {id:'kerala',name:'Kerala',country:'India',state:'Kerala',category:'Wildlife',bestTime:'September - March',duration:'6-8 days',budget:28000,image:'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',description:'Backwaters, tea estates, tropical forests and a relaxed southern rhythm.',attractions:['Munnar','Alleppey','Thekkady','Fort Kochi'],thingsToDo:['Houseboat stay','Tea estate visit','Wildlife safari'],food:['Appam & stew','Kerala sadya','Malabar parotta'],travelTips:['Book houseboats carefully','Carry light rainwear','Respect wildlife-zone rules']},
  {id:'rishikesh',name:'Rishikesh',country:'India',state:'Uttarakhand',category:'Adventure',bestTime:'September - June',duration:'3-5 days',budget:14000,image:'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',description:'Yoga, the Ganges and adrenaline-filled days at the Himalayan foothills.',attractions:['Laxman Jhula','Triveni Ghat','Neer Garh Waterfall'],thingsToDo:['River rafting','Bungee jumping','Yoga session'],food:['North Indian thali','Aloo puri','Café food'],travelTips:['Raft only with licensed operators','Avoid monsoon rafting','Carry quick-dry clothing']},
  {id:'dubai',name:'Dubai',country:'UAE',state:'Dubai',category:'International',bestTime:'November - March',duration:'5-6 days',budget:75000,image:'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',description:'Futuristic skylines, desert adventures, beaches and world-class shopping.',attractions:['Burj Khalifa','Dubai Marina','Old Dubai','Desert'],thingsToDo:['Desert safari','Dhow cruise','Observation deck'],food:['Shawarma','Machboos','Kunafa'],travelTips:['Use Nol card for transport','Dress respectfully in cultural areas','Book major attractions in advance']},
  {id:'bali',name:'Bali',country:'Indonesia',state:'Bali',category:'International',bestTime:'April - October',duration:'6-8 days',budget:65000,image:'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',description:'Rice terraces, temples, surf beaches and wellness escapes.',attractions:['Ubud','Uluwatu','Nusa Penida','Seminyak'],thingsToDo:['Temple visit','Surf lesson','Waterfall tour'],food:['Nasi goreng','Satay','Babi guling'],travelTips:['Carry some cash','Respect temple dress rules','Allow travel time for traffic']}
];

const itineraries = {
  manali:['Arrive in Manali & café walk','Solang Valley adventure day','Atal Tunnel & Sissu excursion','Old Manali and local sightseeing','Departure'],
  goa:['Arrival & beach sunset','North Goa sightseeing','South Goa & heritage','Water sports / leisure','Departure'],
  jaipur:['Arrival & City Palace','Amber Fort & Nahargarh','Markets and cultural evening','Departure'],
  kashmir:['Srinagar & Dal Lake','Gulmarg day','Pahalgam excursion','Sonamarg day','Local Srinagar','Departure'],
  kerala:['Kochi arrival','Munnar tea country','Munnar sightseeing','Thekkady wildlife','Alleppey houseboat','Departure'],
  rishikesh:['Arrival & Ganga Aarti','Rafting & adventure','Waterfall/yoga','Departure'],
  dubai:['Arrival & Marina','City tour + Burj Khalifa','Desert safari','Abu Dhabi optional','Leisure/shopping','Departure'],
  bali:['Arrival & Seminyak','Ubud temples and rice terraces','Waterfalls','Nusa Penida','Uluwatu sunset','Leisure','Departure']
};
const makePackage=(id,name,destinationId,category,duration,adult,child,rating,hotel,image,extras={})=>({id,name,destinationId,destination:destinations.find(d=>d.id===destinationId)?.name,category,duration,pricePerAdult:adult,pricePerChild:child,maxAdults:8,maxChildren:4,maxRooms:5,rating,reviewsCount:Math.floor(rating*31),hotel,meals:'Breakfast included',transport:'Private/shared transfers',activities:destinations.find(d=>d.id===destinationId)?.thingsToDo||[],included:['Hotel accommodation','Daily breakfast','Local transfers','Sightseeing as listed','Trip support'],excluded:['Flights/train unless mentioned','Personal expenses','Travel insurance','Anything not listed in inclusions'],itinerary:(itineraries[destinationId]||[]).map((title,i)=>({day:i+1,title,description:'A balanced day with guided experiences and free time.'})),availableDates:[],images:[image || destinations.find(d=>d.id===destinationId)?.image],active:true,...extras});
export const packages=[
  makePackage('manali-adventure','Manali Adventure Escape','manali','Adventure',5,8999,5999,4.8,'3★ mountain hotel'),
  makePackage('manali-premium','Manali Premium Retreat','manali','Mountains',6,14999,8999,4.9,'4★ resort'),
  makePackage('goa-sun','Goa Sun & Sea','goa','Beaches',5,11999,7499,4.7,'3★ beach hotel'),
  makePackage('goa-luxury','Goa Luxury Weekend','goa','Romance',4,18999,10999,4.9,'4★ boutique resort'),
  makePackage('jaipur-royal','Royal Jaipur Heritage','jaipur','Historical',4,9999,5999,4.8,'Heritage haveli'),
  makePackage('kashmir-paradise','Kashmir Paradise Trail','kashmir','Mountains',6,24999,15999,4.9,'Hotels + houseboat'),
  makePackage('kerala-backwaters','Kerala Backwaters & Hills','kerala','Wildlife',6,21999,12999,4.8,'Resort + houseboat'),
  makePackage('rishikesh-thrill','Rishikesh Thrill Week','rishikesh','Adventure',4,7999,4999,4.6,'Riverside camp'),
  makePackage('dubai-city','Dubai City & Desert','dubai','International',6,45999,30999,4.8,'4★ city hotel'),
  makePackage('bali-bliss','Bali Bliss & Beyond','bali','International',7,39999,25999,4.9,'4★ villas & hotel')
];
export const testimonials=[
  {id:'t1',name:'Aarav Mehta',rating:5,text:'The itinerary felt thoughtful and the booking process was surprisingly smooth.'},
  {id:'t2',name:'Neha Sharma',rating:5,text:'Our Goa trip was well coordinated from hotel to transfers.'},
  {id:'t3',name:'Rohan Gupta',rating:5,text:'The admin confirmation and updates made everything feel reliable.'},
  {id:'t4',name:'Meera Iyer',rating:4,text:'Loved the package details and the easy QR payment flow.'},
  {id:'t5',name:'Kabir Singh',rating:5,text:'Kashmir was beautiful and the day-by-day plan was very useful.'},
  {id:'t6',name:'Ananya Jain',rating:5,text:'Good pricing, clean interface and responsive support.'},
  {id:'t7',name:'Dev Patel',rating:4,text:'A polished travel experience with clear inclusions and pricing.'},
  {id:'t8',name:'Ishita Rao',rating:5,text:'Would book again, especially because the package details are transparent.'}
];
export const seedReviews=[
  {id:'r1',userName:'Ananya Jain',packageId:'bali-bliss',rating:5,title:'Beautiful trip',comment:'Great stays and a well-paced itinerary.',status:'approved',featured:true,createdAt:'2026-08-12T10:00:00.000Z'},
  {id:'r2',userName:'Rohan Gupta',packageId:'manali-adventure',rating:5,title:'Loved Manali',comment:'Solang day was the highlight.',status:'approved',featured:true,createdAt:'2026-08-20T10:00:00.000Z'}
];
export const seedCoupons=[
 {id:'WELCOME10',code:'WELCOME10',type:'percentage',value:10,minimumAmount:5000,expiryDate:'2027-12-31',usageLimit:100,usedCount:0,active:true},
 {id:'FLAT500',code:'FLAT500',type:'fixed',value:500,minimumAmount:10000,expiryDate:'2027-12-31',usageLimit:100,usedCount:0,active:true},
 {id:'CS100',code:'CS100',type:'percentage',value:100,minimumAmount:1000,expiryDate:'2027-12-31',usageLimit:100,usedCount:0,active:true},
 {id:'FIRST1000',code:'FIRST1000',type:'fixed',value:1000,minimumAmount:0,expiryDate:'2027-12-31',usageLimit:100,usedCount:0,active:true}
];
