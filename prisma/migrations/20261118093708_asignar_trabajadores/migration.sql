-- CreateTable
CREATE TABLE "_TrabajadoresDeObra" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TrabajadoresDeObra_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TrabajadoresDeObra_B_index" ON "_TrabajadoresDeObra"("B");

-- AddForeignKey
ALTER TABLE "_TrabajadoresDeObra" ADD CONSTRAINT "_TrabajadoresDeObra_A_fkey" FOREIGN KEY ("A") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TrabajadoresDeObra" ADD CONSTRAINT "_TrabajadoresDeObra_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
