/* trip-core.js — row builders used by each trip's data.js (load before data.js) */
function T(mode,from,ft,to,tt,line,price,transfer){
  return {type:"transit",mode,from,ft,to,tt,line,price,transfer};
}
function A(tag,text,time,map){ return {type:"activity",tag,text,time,map}; }
function N(text){ return {type:"note",text}; }
function S(label){ return {type:"section",label}; }
