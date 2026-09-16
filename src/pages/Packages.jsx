import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportError } from '../lib/feedback';
import PackageCard from '../components/PackageCard';
import { db } from '../lib/dataService';

export default function Packages() {
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const searchDate = params.get('date') || '';
  const requestedAdults = Number(params.get('adults') || 0);
  const requestedChildren = Number(params.get('children') || 0);
  const requestedRooms = Number(params.get('rooms') || 0);
  const [filters, setFilters] = useState({
    destination: params.get('destination') || '',
    category: 'All',
    duration: '',
    rating: '',
    sort: 'recommended',
  });

  useEffect(() => {
    Promise.resolve(db.getPackages())
      .then(packages => setList(packages.filter(item => item.active !== false)))
      .catch(reportError);
  }, []);

  const setFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));

  const shown = useMemo(() => {
    let packages = list.filter(item => (
      (!filters.destination || `${item.destination} ${item.name}`.toLowerCase().includes(filters.destination.toLowerCase()))
      && (filters.category === 'All' || item.category === filters.category)
      && (!filters.duration || Number(item.duration) <= Number(filters.duration))
      && (!filters.rating || Number(item.rating) >= Number(filters.rating))
      && (!requestedAdults || requestedAdults <= Number(item.maxAdults || 999))
      && (!requestedChildren || requestedChildren <= Number(item.maxChildren || 999))
      && (!requestedRooms || requestedRooms <= Number(item.maxRooms || 999))
    ));

    if (filters.sort === 'low') packages.sort((a, b) => Number(a.pricePerAdult) - Number(b.pricePerAdult));
    if (filters.sort === 'high') packages.sort((a, b) => Number(b.pricePerAdult) - Number(a.pricePerAdult));
    if (filters.sort === 'rating') packages.sort((a, b) => Number(b.rating) - Number(a.rating));
    return packages;
  }, [list, filters, searchDate, requestedAdults, requestedChildren, requestedRooms]);

  const clearFilters = () => setFilters({
    destination: '', category: 'All', duration: '', rating: '', sort: 'recommended',
  });

  return <section className="section explore">
    <div className="explore-head">
      <div>
        <span className="eyebrow">FIND YOUR AURA</span>
        <h1>Tour packages</h1>
        <p>Filter by destination, budget, duration and rating.</p>
        {(searchDate || requestedAdults || requestedChildren || requestedRooms) && <p className="search-summary">Search: {searchDate || 'Any date'} · {requestedAdults || 1} adult(s) · {requestedChildren || 0} child(ren) · {requestedRooms || 1} room(s)</p>}
      </div>
      <div className="sort"><span>Sort by</span><select value={filters.sort} onChange={event => setFilter('sort', event.target.value)}><option value="recommended">Recommended</option><option value="low">Lowest price</option><option value="high">Highest price</option><option value="rating">Top rated</option></select></div>
    </div>
    <div className="filter-panel">
      <input placeholder="Destination" value={filters.destination} onChange={event => setFilter('destination', event.target.value)} />
      <select value={filters.category} onChange={event => setFilter('category', event.target.value)}><option>All</option><option>Adventure</option><option>Mountains</option><option>Beaches</option><option>Historical</option><option>Romance</option><option>Wildlife</option><option>International</option></select>
      <select value={filters.duration} onChange={event => setFilter('duration', event.target.value)}><option value="">Any duration</option><option value="4">Up to 4 days</option><option value="5">Up to 5 days</option><option value="7">Up to 7 days</option></select>
      <select value={filters.rating} onChange={event => setFilter('rating', event.target.value)}><option value="">Any rating</option><option value="4.5">4.5+</option><option value="4.8">4.8+</option></select>
      <button className="button secondary" onClick={clearFilters}>Clear filters</button>
    </div>
    <p className="result-count">{shown.length} package{shown.length !== 1 ? 's' : ''} found</p>
    <div className="trip-grid wide">{shown.map(item => <PackageCard item={item} key={item.id} />)}</div>
    {!shown.length && <div className="empty"><h3>No matching packages</h3><p>Try another date, fewer travelers, a higher budget or clear the filters.</p></div>}
  </section>;
}
