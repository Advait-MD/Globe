export default function OrbitControl(camera, popupRef){
    return {enabled: true,autoRotate: true, rotateSpeed: 1, zoomSpeed: 1.2, minDistance: 2, maxDistance: 100, minPolarAngle: 0, maxPolarAngle: Math.PI, distance: 3, theta: 0, phi: Math.PI / 2, targetTheta: 0, targetPhi: Math.PI / 2, targetDistance: 3,isDragging: false,
           previousMousePosition: {x: 0,y: 0},
             init(){
                window.addEventListener("mousedown",(e) => this.onMouseDown(e));
                window.addEventListener("mousemove",(e) => this.onMouseMove(e));
                window.addEventListener("mouseup",() => this.onMouseUp());
                window.addEventListener("wheel",(e) => this.onMouseWheel(e), { passive: false });
            },

            onMouseDown(e){
                this.isDragging = true;
                this.previousMousePosition = {x: e.clientX, y: e.clientY };
            },

            onMouseMove(e){

                if(!this.isDragging) return;

                const deltaX = e.clientX - this.previousMousePosition.x;
                const deltaY = e.clientY - this.previousMousePosition.y;
                this.targetTheta -=deltaX * 0.01;
                this.targetPhi += deltaY * 0.01;
                this.targetPhi = Math.max(
                    this.minPolarAngle,
                    Math.min(this.maxPolarAngle,this.targetPhi)
                );

                this.previousMousePosition = {x: e.clientX,y: e.clientY};
            },

            onMouseUp(){ this.isDragging = false;
            },

            onMouseWheel(e){
                e.preventDefault();
                const direction = e.deltaY > 0 ? 1 : -1;
                this.targetDistance *= Math.pow(this.zoomSpeed,direction * 0.1 );
                this.targetDistance = Math.max( this.minDistance,Math.min(this.maxDistance,this.targetDistance));
            },

            update(){

                if( this.autoRotate && !this.isDragging && !popupRef.current)
                { this.targetTheta += 0.0007; }

                const easing = 0.1;

                this.theta += (this.targetTheta - this.theta)  * easing;
                this.phi += (this.targetPhi - this.phi) * easing;
                this.distance +=( this.targetDistance - this.distance ) * easing;

                const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
                const y = this.distance * Math.cos(this.phi);
                const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta);

                camera.position.set(x,y,z);

                camera.lookAt(0,0,0);
            }
        };
}