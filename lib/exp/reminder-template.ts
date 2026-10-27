/** Rental-specific EXP copy is opt-in. Tours and mixed itineraries retain the shared reminder. */
export function selectRentalReminderTemplate(defaultTemplate:string,rentalTemplate:string|undefined,rows:ReadonlyArray<{business_line:string|null}>){
 const rentalOnly=rows.length>0 && rows.every(row=>row.business_line?.trim().toLowerCase()==="rental");
 return rentalOnly && rentalTemplate?.trim()?rentalTemplate.trim():defaultTemplate;
}
